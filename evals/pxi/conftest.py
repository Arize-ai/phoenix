"""Record-only pytest harness for the PXI evals.

The eval tests never hard-assert. This conftest buffers one datapoint per
evaluation (emitted by the tests via ``record_property("pxi_eval", ...)``),
tracks session health, and writes a single ``pxi-eval-results.json`` artifact
on the xdist controller. It never decides pass/fail and never touches
``session.exitstatus`` -- ``gate.py`` is the sole decider.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, AsyncIterator

import pytest_asyncio
from phoenix.client.pytest.plugin import _get_state  # pyright: ignore[reportPrivateUsage]

from evals.pxi.harness.agent_task import (
    build_shared_docs_mcp_server,
    flush_agent_telemetry,
)

RESULTS_PATH_ENV = "PXI_EVAL_RESULTS_PATH"
DEFAULT_RESULTS_PATH = "pxi-eval-results.json"
SCHEMA_VERSION = 3
RECORD_PROPERTY_KEY = "pxi_eval"

# Per-process buffers. Under xdist the controller's ``pytest_runtest_logreport``
# fires for every worker's report (user_properties survive the boundary), so the
# controller alone accumulates the full run and writes the artifact.
_rows: list[dict[str, Any]] = []
_health = {"collected": 0, "completed": 0, "errors": 0}


@pytest_asyncio.fixture(scope="session")
async def docs_mcp_toolset() -> AsyncIterator[Any]:
    """Enter the shared docs-MCP toolset once per worker for the whole session.

    Yields ``None`` when the production gates (assistant enabled + external
    resources allowed) are off, mirroring the server, in which case the agent
    simply runs without docs tools.
    """
    server = build_shared_docs_mcp_server()
    if server is None:
        yield None
        return
    async with server:
        yield server


def pytest_runtest_logreport(report: Any) -> None:
    if report.when == "setup":
        _health["collected"] += 1
        if report.failed:
            _health["errors"] += 1
    elif report.when == "call":
        if not report.skipped:
            _health["completed"] += 1
        if report.failed:
            _health["errors"] += 1
        for name, value in report.user_properties:
            if name == RECORD_PROPERTY_KEY:
                _rows.append(json.loads(value))
    elif report.when == "teardown":
        if report.failed:
            _health["errors"] += 1


def pytest_sessionfinish(session: Any, exitstatus: Any) -> None:
    # Before the worker early-return: each xdist process flushes its own spans.
    flush_agent_telemetry()
    # Workers post their reports to the controller, which owns the single write.
    if hasattr(session.config, "workerinput"):
        return
    artifact = _build_artifact(int(exitstatus), _recording_status(session.config))
    path = Path(os.environ.get(RESULTS_PATH_ENV, DEFAULT_RESULTS_PATH))
    path.write_text(json.dumps(artifact, indent=2, sort_keys=True) + "\n")


def _recording_status(config: Any) -> dict[str, Any]:
    """Recording-health block for the artifact, read from the phoenix-client plugin's suite state.

    The plugin degrades an experiment-bootstrap failure to a warning and keeps running, so a
    session can finish green having recorded nothing to Phoenix. ``gate.py`` fails closed on that
    only when recording was *expected*: a ``PHOENIX_API_KEY`` is set and tracking is on. No key
    means local dev where recording is optional, so ``expected`` is False and the gate skips it.
    ``bootstrapped`` is true only when every collected dataset got an experiment and no bootstrap
    error was recorded -- partial recording is still a failure.
    """
    state = _get_state(config)
    if state is None:
        return {"expected": False, "bootstrapped": False, "experiments": 0, "error": None}
    groups = state.groups
    experiments = sum(1 for g in groups.values() if g.experiment_id is not None)
    error = state.bootstrap_error
    return {
        "expected": bool(os.environ.get("PHOENIX_API_KEY")) and not state.config.offline,
        "bootstrapped": error is None and len(groups) > 0 and experiments == len(groups),
        "experiments": experiments,
        "error": repr(error) if error is not None else None,
    }


def _pass_rate(passed: int, scored: int) -> float:
    return passed / scored if scored else 0.0


def _build_artifact(exitstatus: int, recording: dict[str, Any]) -> dict[str, Any]:
    # dataset -> evaluator -> split -> {scored, passed}
    grouped: dict[str, dict[str, dict[str, dict[str, int]]]] = {}
    for row in _rows:
        evaluators = grouped.setdefault(str(row["dataset"]), {})
        splits = evaluators.setdefault(str(row["evaluator"]), {})
        tally = splits.setdefault(str(row["split"]), {"scored": 0, "passed": 0})
        tally["scored"] += 1
        if row["passed"]:
            tally["passed"] += 1

    datasets_out: list[dict[str, Any]] = []
    for dataset_name in sorted(grouped):
        evaluators_out: list[dict[str, Any]] = []
        for evaluator_name in sorted(grouped[dataset_name]):
            split_tallies = grouped[dataset_name][evaluator_name]
            splits_out: dict[str, Any] = {}
            total_scored = 0
            total_passed = 0
            for split_name in sorted(split_tallies):
                tally = split_tallies[split_name]
                total_scored += tally["scored"]
                total_passed += tally["passed"]
                splits_out[split_name] = {
                    "scored": tally["scored"],
                    "passed": tally["passed"],
                    "pass_rate": _pass_rate(tally["passed"], tally["scored"]),
                }
            evaluators_out.append(
                {
                    "evaluator": evaluator_name,
                    "scored": total_scored,
                    "passed": total_passed,
                    "pass_rate": _pass_rate(total_passed, total_scored),
                    "splits": splits_out,
                }
            )
        datasets_out.append({"dataset": dataset_name, "evaluators": evaluators_out})

    # Report arrival order on the xdist controller is not deterministic; sort the
    # raw rows by their canonical form so artifact diffs stay stable across replays.
    rows_out = sorted(_rows, key=lambda row: json.dumps(row, sort_keys=True))

    return {
        "schema_version": SCHEMA_VERSION,
        "session": {
            "status": exitstatus,
            "collected": _health["collected"],
            "completed": _health["completed"],
            "errors": _health["errors"],
        },
        "recording": recording,
        "datasets": datasets_out,
        "rows": rows_out,
    }
