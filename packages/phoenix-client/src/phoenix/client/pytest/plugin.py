from __future__ import annotations

import logging
import os
from contextlib import AbstractContextManager, nullcontext
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Optional, cast

import pytest
from _pytest.outcomes import Skipped

from .config import PhoenixTestConfig, PhoenixTestConfigError
from .context import (
    _RunRecord,  # pyright: ignore[reportPrivateUsage]
    reset_current_run,
    set_current_run,
)
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

    from .tracing import SpanHandle

logger = logging.getLogger(__name__)

_PASS_ANNOTATION = "pass"

# Plugin state lives on ``config.stash`` via typed ``StashKey``s rather than stringly-typed
# private attributes: type-safe, collision-free, and the mechanism pytest provides for exactly
# this (pytest >= 7). ``_STATE_KEY`` holds the per-suite ``SuiteState``; ``_SESSION_KEY`` hands
# the controller's session to ``pytest_configure_node`` (xdist can't collect on the controller
# during the normal collection phase); ``_CONTROLLER_COLLECTED_KEY`` bounds the forced
# controller-side collection to a single attempt.
_STATE_KEY: "pytest.StashKey[SuiteState]" = pytest.StashKey()
_SESSION_KEY: "pytest.StashKey[pytest.Session]" = pytest.StashKey()
_CONTROLLER_COLLECTED_KEY: "pytest.StashKey[bool]" = pytest.StashKey()


@dataclass
class _PendingRun:
    """Run context captured during the call phase, finalized at teardown once ``makereport`` has
    classified every phase. The pass/fail decision needs the call report (built after the call
    phase), and posting is deferred to teardown so a teardown failure can downgrade the verdict."""

    binding: Any
    record: _RunRecord
    start_time: datetime
    end_time: datetime
    repetition_number: int
    skipped: bool = False
    passed: bool = True
    error: Optional[str] = None


# Carries the pending run from the call hookwrapper to makereport on the same item.
_PENDING_RUN_KEY: "pytest.StashKey[_PendingRun]" = pytest.StashKey()


def pytest_addoption(parser: "Parser") -> None:
    parser.addini(
        "phoenix_dataset",
        help=(
            "Phoenix dataset name override; collapses the collected tests into one experiment. "
            "The PHOENIX_TEST_DATASET env var takes precedence over this."
        ),
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
    return config.stash.get(_STATE_KEY, None)


def _is_xdist_worker(config: "Config") -> bool:
    return hasattr(config, "workerinput")


def _is_xdist_controller(config: "Config") -> bool:
    """True on the xdist controller: distribution is active (``-n``/``--dist``) and this is not a
    worker. xdist short-circuits item collection on the controller, so the plugin must force a
    collection here (see ``pytest_sessionstart``) to bootstrap before workers start."""
    if _is_xdist_worker(config):
        return False
    return getattr(getattr(config, "option", None), "dist", "no") != "no"


@pytest.hookimpl(tryfirst=True)
def pytest_sessionstart(session: pytest.Session) -> None:
    """Stash the session so the xdist controller can collect in ``pytest_configure_node``.

    We can't collect here: other plugins initialize during ``pytest_sessionstart`` too, and forcing
    a collection before they're ready crashes plugins that hook collection (e.g. syrupy sets
    ``config._syrupy`` in its own sessionstart, then trips in ``pytest_collection_finish``). By
    ``pytest_configure_node`` every sessionstart hook has run, so collection is safe there.
    """
    if _is_xdist_controller(session.config):
        session.config.stash[_SESSION_KEY] = session


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

    config.stash[_STATE_KEY] = state

    if cfg.offline:
        return
    if _is_xdist_worker(config):
        # Workers reuse the controller's ids; experiment creation isn't idempotent (the upsert is).
        workerinput = cast("dict[str, Any]", config.workerinput)  # type: ignore[attr-defined]
        broadcast = cast(
            "Optional[dict[str, dict[str, Any]]]", workerinput.get("phoenix_experiments")
        )
        if broadcast:
            state.adopt_broadcast(broadcast, client=_make_client())
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


@pytest.hookimpl(optionalhook=True)
def pytest_configure_node(node: Any) -> None:  # pragma: no cover - exercised via xdist subprocess
    """xdist controller hook (once per worker): ensure the controller has collected + bootstrapped,
    then broadcast the experiment ids to the worker via ``workerinput``.

    The controller can't collect in the normal collection phase (xdist forbids it) nor in
    ``pytest_sessionstart`` (other plugins aren't initialized that early). By this hook every
    sessionstart hook has run, so the one-time forced collection in ``_ensure_controller_collected``
    is safe.

    ``optionalhook=True`` because this is an xdist hookspec: xdist is not a dependency of the
    ``pytest`` extra, and without the marker pytest's ``check_pending`` would raise a
    ``PluginValidationError`` on every run when xdist is absent.
    """
    config = node.config
    _ensure_controller_collected(config)
    state = _get_state(config)
    if state is None or state.config.offline:
        return
    _bootstrap_controller(state)
    node.workerinput["phoenix_experiments"] = state.broadcast_payload()


def _ensure_controller_collected(config: "Config") -> None:
    """Force a one-time controller-side collection under xdist, building the suite state.

    Bounded to a single attempt (so a non-Phoenix suite pays at most one extra collection pass)
    and never raises: if collection fails, recording stays disabled rather than the suite broken.
    Uses ``perform_collect`` (not raw ``genitems``) so deselection (``-k``/``-m``) still applies.
    Set ``PHOENIX_TEST_TRACKING=false`` to skip it entirely.
    """
    if config.stash.get(_CONTROLLER_COLLECTED_KEY, False):
        return
    config.stash[_CONTROLLER_COLLECTED_KEY] = True
    if _get_state(config) is not None:
        return
    session = config.stash.get(_SESSION_KEY, None)
    if session is None:
        return
    try:
        cfg = PhoenixTestConfig.from_env(dataset_override=config.getini("phoenix_dataset") or None)
    except PhoenixTestConfigError:
        return  # surfaces as a UsageError when the worker runs its own collection
    if cfg.offline:
        return
    try:
        session.perform_collect()
    except Exception as e:  # noqa: BLE001
        logger.warning("Phoenix plugin: controller-side collection under xdist failed: %s", e)


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_call(item: "Item") -> Any:
    """Open the test's CHAIN span and capture the run context, stashing it for ``makereport`` to
    finalize. The pass/fail decision is deferred there because the call phase alone cannot tell a
    failure from an expected-xfail or an in-body skip (both raise here but pytest resolves them
    later, in ``makereport``)."""
    outcome: Any = None
    state = _get_state(item.config)
    binding = state.binding_for(item) if state is not None else None
    if binding is None:
        outcome = yield
        return outcome

    assert state is not None
    tracer = state.tracer_for(binding.dataset_name)
    record = _RunRecord(nodeid=item.nodeid, external_id=binding.external_id, tracer=tracer)
    token = set_current_run(record)
    start_time = datetime.now(timezone.utc)
    handle: Optional[SpanHandle] = None
    span_cm: AbstractContextManager[Optional[SpanHandle]] = (
        tracer.chain_span(
            f"Test: {item.nodeid}",
            input_value=_chain_input(item),
            output_getter=lambda: record.output,
            # pytest captures a failing test's exception into ``outcome`` rather than raising
            # it through the hookwrapper ``yield``; hand it to the span so it records ERROR.
            error_getter=lambda: outcome.excinfo[1] if outcome.excinfo else None,
        )
        if tracer is not None
        else nullcontext(None)
    )
    try:
        with span_cm as handle:
            outcome = yield
    finally:
        record.trace_id = handle.trace_id if handle is not None else None
        reset_current_run(token)
        end_time = datetime.now(timezone.utc)
        excinfo: Any = outcome.excinfo  # (type, value, tb) or None
        exc = excinfo[1] if excinfo is not None else None
        if exc is not None and not isinstance(exc, Skipped) and record.trace_id:
            # Surface the trace id in the failure output so a reader (human or agent) can open
            # the underlying trace in Phoenix straight from the test log. Skips raise here too
            # but aren't failures, so they get no hint.
            project = state.project_name_for(binding.dataset_name)
            hint = f"trace_id: {record.trace_id}"
            if project:
                hint += f"\nproject: {project}"
            item.add_report_section("call", "phoenix trace", hint)
        # Server expects a 1-based repetition_number.
        item.stash[_PENDING_RUN_KEY] = _PendingRun(
            binding=binding,
            record=record,
            start_time=start_time,
            end_time=end_time,
            repetition_number=repetition_index(item) + 1,
        )
    return outcome


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item: "Item", call: Any) -> Any:
    """Finalize the run from pytest's per-phase reports, so the recorded outcome reflects the
    whole test lifecycle rather than the call phase alone:

    - a **setup** failure (e.g. a fixture error) is recorded as an errored run — the call hook
      never fires for it, so without this the case would silently vanish from the experiment;
    - the **call** verdict is captured but not posted yet (``passed`` incl. non-strict xpass;
      ``failed`` incl. strict xpass; ``skipped`` in-body ``pytest.skip``/expected-xfail);
    - posting is deferred to **teardown** so a teardown failure downgrades an otherwise-passing
      run to a failure, matching pytest's own verdict (it reports such a test as an error).

    In-body skips and expected-xfails are not recorded, matching marker-level skips that never
    reach the call phase.

    Classification reads ``report.outcome`` (via ``report.skipped``/``passed``/``failed``), never
    the raw call-phase ``excinfo``: ``_pytest.skipping`` resolves xfail/xpass at makereport time
    by mutating ``rep.outcome`` (failing-xfail -> ``skipped``, non-strict xpass -> ``passed``,
    strict xpass -> ``failed``), so the resolved outcome is already encoded there. ``call.excinfo``
    is used only for the human-readable error string. ``report.wasxfail`` is intentionally not
    consulted: the recording policy treats xfail-skip like any skip and xpass like any pass, so it
    needs no xfail-vs-skip discrimination beyond ``report.outcome``.
    """
    outcome: Any = yield
    state = _get_state(item.config)
    if state is None:
        return
    report: Any = outcome.get_result()

    if report.when == "setup":
        if report.failed:
            _record_setup_error(state, item, call)
        return

    if _PENDING_RUN_KEY not in item.stash:
        return
    pending = item.stash[_PENDING_RUN_KEY]

    if report.when == "call":
        if report.skipped:
            pending.skipped = True
        else:
            pending.passed = bool(report.passed)
            if not pending.passed:
                pending.error = _excinfo_repr(call) or "test failed"
        return

    if report.when == "teardown":
        del item.stash[_PENDING_RUN_KEY]
        if pending.skipped:
            return
        passed = pending.passed
        error = pending.error
        if report.failed:
            # The body may have passed, but teardown errored; pytest reports this as an error,
            # so the recorded run must not claim success.
            passed = False
            error = error or _excinfo_repr(call) or "teardown failed"
        state.record_run(
            pending.binding,
            record=pending.record,
            start_time=pending.start_time,
            end_time=pending.end_time,
            passed=passed,
            error=error,
            pass_annotation=_PASS_ANNOTATION,
            repetition_number=pending.repetition_number,
        )


def _excinfo_repr(call: Any) -> Optional[str]:
    """``repr`` of the exception captured for a phase (``None`` when the phase did not raise)."""
    excinfo = getattr(call, "excinfo", None)
    exc = excinfo.value if excinfo is not None else None
    return repr(exc) if exc is not None else None


def _record_setup_error(state: SuiteState, item: "Item", call: Any) -> None:
    """Record an errored run for a case whose setup failed.

    The call hook never runs for a setup failure, so no run context was captured: there is no
    output and no test span. Hoisted evaluators are suppressed (there is nothing to evaluate);
    only the ``pass=fail`` annotation is recorded so the error is visible in the experiment
    instead of the case silently disappearing.
    """
    binding = state.binding_for(item)
    if binding is None:
        return
    record = _RunRecord(nodeid=item.nodeid, external_id=binding.external_id, tracer=None)
    start_time, end_time = _call_times(call)
    state.record_run(
        binding,
        record=record,
        start_time=start_time,
        end_time=end_time,
        passed=False,
        error=_excinfo_repr(call) or "setup failed",
        pass_annotation=_PASS_ANNOTATION,
        repetition_number=repetition_index(item) + 1,
        run_evaluators=False,
    )


def _call_times(call: Any) -> tuple[datetime, datetime]:
    """The phase's (start, stop) as UTC datetimes, falling back to ``now`` if unavailable."""
    start = getattr(call, "start", None)
    stop = getattr(call, "stop", None)
    if isinstance(start, (int, float)) and isinstance(stop, (int, float)):
        return (
            datetime.fromtimestamp(start, timezone.utc),
            datetime.fromtimestamp(stop, timezone.utc),
        )
    now = datetime.now(timezone.utc)
    return now, now


def pytest_terminal_summary(terminalreporter: Any, exitstatus: int, config: "Config") -> None:
    state = _get_state(config)
    if state is None or _is_xdist_worker(config):
        return

    write = terminalreporter.write_line
    if state.config.offline:
        write(state.offline_summary_line())
    else:
        write(state.summary_line())


def _chain_input(item: "Item") -> dict[str, Any]:
    """The CHAIN span input: the test's parametrized fields, or its nodeid when unparametrized."""
    callspec = getattr(item, "callspec", None)
    if callspec is not None and getattr(callspec, "params", None):
        params = {k: v for k, v in callspec.params.items() if k != REPETITION_PARAM}
        if params:
            return params
    return {"nodeid": item.nodeid}


def _make_client() -> Any:
    from phoenix.client import Client

    return Client()
