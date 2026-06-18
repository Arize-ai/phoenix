"""Phoenix pytest plugin: map a pytest suite onto a Phoenix dataset + experiment.

Mapping (D7): suite (resolved ``dataset=`` name, default = module name) = dataset; test =
example + run; assertion outcome = reserved ``pass`` annotation; ``@pytest.mark.phoenix``
evaluators / inline ``px.evaluate`` = extra annotations; ``PHOENIX_TEST_*`` env contract shared
with the TS runner.

Lifecycle:
- ``pytest_collection_modifyitems``: group marked items by resolved dataset name, dedup, expand
  repetitions, and assign each item a stable ``external_id``.
- session start: per dataset name, upsert the dataset (D15 partial-run guard) and create one
  experiment (D14: the xdist controller creates and broadcasts; workers reuse).
- ``pytest_runtest_call`` hookwrapper: set/reset the per-run contextvar for marked items, derive
  ``pass`` + run ``error`` from the single ``outcome.excinfo`` signal, and post run + annotations.
- ``pytest_terminal_summary``: fetch the summary endpoint, print baseline diffs, and gate (D9).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Optional

import pytest

from .config import PhoenixTestConfig, PhoenixTestConfigError
from .context import _RunRecord, reset_current_run, set_current_run
from .marker import (
    MARKER_NAME,
    REPETITION_PARAM,
    iter_phoenix_items,
    repetition_index,
    resolve_dataset_name,
    resolve_repetitions,
    stable_external_id,
)
from .repo_info import collect_repo_info
from .session import SuiteState

if TYPE_CHECKING:
    from _pytest.config import Config
    from _pytest.config.argparsing import Parser
    from _pytest.nodes import Item

logger = logging.getLogger(__name__)

_STATE_ATTR = "_phoenix_suite_state"
_PASS_ANNOTATION = "pass"


def pytest_addoption(parser: "Parser") -> None:
    parser.addini(
        "phoenix_dataset",
        help="Phoenix dataset name override; collapses the whole session into one experiment.",
        default=None,
    )


def pytest_configure(config: "Config") -> None:
    config.addinivalue_line(
        "markers",
        "phoenix(dataset=None, evaluators=None): record this test as a Phoenix experiment run.",
    )


@pytest.fixture(name=REPETITION_PARAM, autouse=True)
def _phoenix_repetition() -> int:
    """Injected repetition index. Auto-used so it is always a known fixture name on marked
    tests; ``pytest_generate_tests`` parametrizes it to 0..N-1 when N>1. Tests never declare it
    (the name is dunder-private), so it does not appear in their signatures."""
    return 0


def pytest_generate_tests(metafunc: Any) -> None:
    """Expand a marked test into N native pytest items, one per repetition (D14).

    Each expanded item carries the injected ``__phoenix_repetition__`` param (0..N-1), so the
    repetitions become real pytest items (visible to ``-k``, xdist, IDEs) rather than a hidden
    in-hook loop. ``repetition_number`` is then derived per item and the shared ``external_id``
    is held stable across repetitions. unittest ``TestCase`` methods receive no fixtures and so
    are not expanded here; they record a single run (repetition_number 1).
    """
    marker = metafunc.definition.get_closest_marker(MARKER_NAME)
    if marker is None:
        return
    if REPETITION_PARAM not in metafunc.fixturenames:
        # unittest TestCase methods (no fixtures) cannot host the injected param.
        return
    try:
        cfg = PhoenixTestConfig.from_env(
            dataset_override=metafunc.config.getini("phoenix_dataset") or None
        )
    except PhoenixTestConfigError as e:
        raise pytest.UsageError(str(e)) from e
    try:
        reps = resolve_repetitions(marker, env_default=cfg.repetitions)
    except ValueError as e:
        raise pytest.UsageError(str(e)) from e
    if reps <= 1:
        return
    # ids "phxrep{n}" are stripped from the external_id (see marker.stable_external_id) so all
    # repetitions of one case map to the same dataset example.
    metafunc.parametrize(
        REPETITION_PARAM,
        list(range(reps)),
        ids=[f"phxrep{n}" for n in range(reps)],
    )


def _get_state(config: "Config") -> Optional[SuiteState]:
    return getattr(config, _STATE_ATTR, None)


def _is_xdist_worker(config: "Config") -> bool:
    return hasattr(config, "workerinput")


@pytest.hookimpl(trylast=True)
def pytest_collection_modifyitems(
    session: pytest.Session, config: "Config", items: "list[Item]"
) -> None:
    """Group marked items by resolved dataset name, dedup, and stamp stable external_ids (D13)."""
    try:
        cfg = PhoenixTestConfig.from_env(dataset_override=config.getini("phoenix_dataset") or None)
    except PhoenixTestConfigError as e:
        # Misconfiguration is a hard error so CI never silently runs ungated.
        raise pytest.UsageError(str(e)) from e

    phoenix_items = list(iter_phoenix_items(items))
    if not phoenix_items:
        return

    # A partial collection (-k, single nodeid, last-failed, ...) must not drive an
    # action="update" sync, because update DELETES latest-version examples absent from the
    # upload and would prune the shared dataset (D15 partial-run guard).
    partial = _is_partial_collection(session, config)

    state = SuiteState(config=cfg, partial_collection=partial)
    for item in phoenix_items:
        dataset_name = resolve_dataset_name(item, override=cfg.dataset_override)
        external_id = stable_external_id(item)
        reps = resolve_repetitions(
            item.get_closest_marker(MARKER_NAME), env_default=cfg.repetitions
        )
        state.register_item(
            item, dataset_name=dataset_name, external_id=external_id, repetitions=reps
        )

    setattr(config, _STATE_ATTR, state)

    # Bootstrap (dataset upsert + experiment creation) runs here, NOT at session start, because
    # collection has only just produced the items we sync. Offline => no client, zero network.
    if cfg.offline:
        return
    if _is_xdist_worker(config):
        # Workers reuse the controller-broadcast experiment ids; they NEVER create experiments
        # (experiment creation is not idempotent, unlike the dataset upsert) (D14).
        workerinput: dict[str, Any] = config.workerinput  # type: ignore[attr-defined]
        broadcast = workerinput.get("phoenix_experiments")
        if broadcast:
            state.adopt_broadcast(broadcast)
        return
    _bootstrap_controller(state)


def _is_partial_collection(session: pytest.Session, config: "Config") -> bool:
    """Heuristic: did the user filter the collection? If so, never update-sync the dataset."""
    option = getattr(config, "option", None)
    if option is None:
        return False
    if getattr(option, "keyword", None):
        return True
    if getattr(option, "markexpr", None):
        return True
    if getattr(option, "last_failed", False) or getattr(option, "failed_first", False):
        return True
    if getattr(option, "lf", False) or getattr(option, "ff", False):
        return True
    # An explicit nodeid argument (``path::test``) narrows the collection; treat as partial so a
    # single-test local run never update-syncs (and prunes) the shared dataset (D15).
    args = getattr(session.config, "args", []) or []
    for arg in args:
        if "::" in arg:
            return True
        if os.path.isfile(arg):
            # A specific file argument narrows collection to one file.
            return True
    return False


def _bootstrap_controller(state: SuiteState) -> None:
    """Upsert datasets + create experiments on the controller. Idempotent (no-op once done)."""
    if state.bootstrapped:
        return
    repo_info = collect_repo_info() if state.config.collect_repo_info else {}
    try:
        state.bootstrap(_make_client(), repo_info=repo_info, pass_annotation=_PASS_ANNOTATION)
    except Exception as e:  # noqa: BLE001
        # With no gate configured, uploads are best-effort: a bootstrap failure disables
        # recording but does not fail the run. A configured gate turns this fatal at teardown.
        logger.warning("Phoenix plugin: failed to initialize experiment recording: %s", e)
        state.record_bootstrap_error(e)


def pytest_configure_node(node: Any) -> None:  # pragma: no cover - xdist hook
    """xdist controller hook: bootstrap (if not yet) then broadcast experiment ids to each
    worker via ``workerinput`` (D14). Workers never create experiments themselves."""
    state = _get_state(node.config)
    if state is None or state.config.offline:
        return
    _bootstrap_controller(state)
    node.workerinput["phoenix_experiments"] = state.broadcast_payload()


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_call(item: "Item") -> Any:
    """Single status-join hook: own the run accumulator and derive ``pass``+``error`` from one
    signal (``outcome.excinfo``), then post the run and its annotations (D12/D14)."""
    state = _get_state(item.config)
    binding = state.binding_for(item) if state is not None else None
    if binding is None:
        # Not a marked Phoenix item; leave pytest entirely untouched.
        outcome = yield
        return outcome

    record = _RunRecord(nodeid=item.nodeid, external_id=binding.external_id)
    token = set_current_run(record)
    start_time = datetime.now(timezone.utc)
    try:
        outcome = yield
    finally:
        reset_current_run(token)
        end_time = datetime.now(timezone.utc)
        excinfo = outcome.excinfo  # (type, value, tb) or None
        error = None
        passed = True
        if excinfo is not None:
            exc = excinfo[1]
            passed = False
            error = repr(exc)
        # The same signal feeds the run error field and the `pass` annotation; pytest's own
        # report (outcome) is left untouched so terminal status stays correlated by construction.
        assert state is not None
        # The 0-based repetition index comes from the expanded item; the server wants a 1-based
        # repetition_number, and the (experiment, example, repetition_number) tuple is unique so
        # distinct repetitions never collide within the fresh experiment.
        state.record_run(
            binding,
            record=record,
            start_time=start_time,
            end_time=end_time,
            passed=passed,
            error=error,
            pass_annotation=_PASS_ANNOTATION,
            repetition_number=repetition_index(item) + 1,
        )
    return outcome


def pytest_terminal_summary(terminalreporter: Any, exitstatus: int, config: "Config") -> None:
    state = _get_state(config)
    if state is None or _is_xdist_worker(config):
        return

    write = terminalreporter.write_line
    if state.config.offline:
        write(state.offline_summary_line())
    else:
        write(state.summary_line())


def _make_client() -> Any:
    from phoenix.client import Client

    return Client()
