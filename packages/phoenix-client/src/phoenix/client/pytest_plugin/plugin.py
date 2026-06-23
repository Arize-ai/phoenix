"""Map a pytest suite onto a Phoenix dataset + experiment: suite = dataset, test = example +
run, assertion outcome = reserved ``pass`` annotation, marker/inline evaluators = annotations.
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
    """Repetition index; autouse so the param name always resolves for ``pytest_generate_tests``."""
    return 0


def pytest_generate_tests(metafunc: Any) -> None:
    """Parametrize each marked test into N native pytest items, one per repetition.

    unittest ``TestCase`` methods receive no fixtures, so they are not expanded and record a
    single run (repetition_number 1).
    """
    marker = metafunc.definition.get_closest_marker(MARKER_NAME)
    if marker is None:
        return
    if REPETITION_PARAM not in metafunc.fixturenames:
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
    # ``phxrepN`` ids are stripped in marker.stable_external_id so all reps share one example.
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
    """Group marked items by resolved dataset name, dedup, and stamp stable external_ids."""
    try:
        cfg = PhoenixTestConfig.from_env(dataset_override=config.getini("phoenix_dataset") or None)
    except PhoenixTestConfigError as e:
        raise pytest.UsageError(str(e)) from e

    phoenix_items = list(iter_phoenix_items(items))
    if not phoenix_items:
        return

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

    if cfg.offline:
        return
    if _is_xdist_worker(config):
        # Workers reuse the controller's ids; experiment creation isn't idempotent (the upsert is).
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
    args = getattr(session.config, "args", []) or []
    for arg in args:
        if "::" in arg:
            return True
        if os.path.isfile(arg):
            return True
    return False


def _bootstrap_controller(state: SuiteState) -> None:
    """Upsert datasets + create experiments on the controller. Idempotent (no-op once done)."""
    if state.bootstrapped:
        return
    try:
        state.bootstrap(_make_client(), pass_annotation=_PASS_ANNOTATION)
    except Exception as e:  # noqa: BLE001
        logger.warning("Phoenix plugin: failed to initialize experiment recording: %s", e)
        state.record_bootstrap_error(e)


def pytest_configure_node(node: Any) -> None:  # pragma: no cover - xdist hook
    """xdist controller hook: bootstrap then broadcast experiment ids via ``workerinput``."""
    state = _get_state(node.config)
    if state is None or state.config.offline:
        return
    _bootstrap_controller(state)
    node.workerinput["phoenix_experiments"] = state.broadcast_payload()


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_call(item: "Item") -> Any:
    """Own the run accumulator: derive ``pass``+``error`` from ``outcome.excinfo``, then post
    the run and its annotations."""
    state = _get_state(item.config)
    binding = state.binding_for(item) if state is not None else None
    if binding is None:
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
        assert state is not None
        # Server expects a 1-based repetition_number.
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
