"""Pytest harness for the MCP surface benchmark.

One pytest session puts ONE agent (arm) under test, selected with the
``MCP_BENCHMARK_ARM`` env var. The phoenix-client pytest plugin records the
session as a fresh experiment on the shared ``mcp-surface-benchmark`` dataset,
so comparing agents means running the suite once per arm, in succession, then
rendering the cross-arm report from the saved session artifacts:

    MCP_BENCHMARK_ARM=phoenix_mcp uv run pytest evals/mcp -c evals/mcp/pytest.ini
    MCP_BENCHMARK_ARM=code_mode   uv run pytest evals/mcp -c evals/mcp/pytest.ini
    uv run python -m evals.mcp.report evals/mcp/results/session-*.json

Session-scoped fixtures own everything measured once per session — the arm,
the ground-truth bundle, the advertised-catalog probe, and the no-tools token
baseline — and mirror themselves into the session artifact's meta block at
``pytest_sessionfinish``.
"""

# ruff: noqa: I001 -- repository import formatter and lint resolver disagree on local `evals`.

from __future__ import annotations

import json
import os
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Optional

import pytest
import pytest_asyncio

from evals.mcp.harness.arms import Arm, build_arms
from evals.mcp.harness.environment import BenchmarkConfig, BenchmarkEnvError
from evals.mcp.harness.fixture import verify_environment, verify_mirror
from evals.mcp.harness.ground_truth import compute_ground_truth
from evals.mcp.harness.runner import (
    CatalogProbe,
    measure_no_tools_baseline,
    probe_catalog,
)
from evals.mcp.harness.sessions import write_session

RESULTS_DIR = Path(__file__).parent / "results"

#: ``record_property`` key each test emits its run row under. Rows travel to the
#: controller via pytest's report ``user_properties``, which survive xdist.
RECORD_PROPERTY_KEY = "mcp_run"

# Per-process buffers, written to one artifact at session end (same pattern as
# evals/pxi). ``_meta`` is populated by the session fixtures as they resolve.
_runs: list[dict[str, Any]] = []
_meta: dict[str, Any] = {}


def _session_runs_benchmark(request: Any) -> bool:
    """Whether any collected test actually benchmarks an agent.

    The benchmark tests carry ``@pytest.mark.phoenix``; the plain unit tests
    (fixture generator, gate logic) do not. The autouse session fixtures below
    check this before touching the environment, so the unit tests run with no
    Phoenix, no API key, and no ``MCP_BENCHMARK_ARM`` — hermetically, in CI.
    """
    return any(item.get_closest_marker("phoenix") is not None for item in request.session.items)


@pytest.fixture(scope="session")
def benchmark_config() -> BenchmarkConfig:
    try:
        config = BenchmarkConfig.from_env()
    except BenchmarkEnvError as error:
        raise pytest.UsageError(str(error)) from error
    _meta.update(
        arm=config.arm_name,
        model=config.model,
        judge_model=config.judge_model,
        base_url=config.base_url,
        started_at=datetime.now(timezone.utc).isoformat(),
    )
    return config


@pytest.fixture(scope="session")
def arm(benchmark_config: BenchmarkConfig) -> Arm:
    """The one agent under test this session."""
    arms = build_arms(
        code_mode_url=f"{benchmark_config.base_url.rstrip('/')}/mcp",
        tool_groups_url=f"{benchmark_config.tool_groups_url.rstrip('/')}/mcp",
        phoenix_base_url=benchmark_config.base_url,
        api_key=benchmark_config.api_key,
    )
    selected = next(a for a in arms if a.name == benchmark_config.arm_name)
    _meta["arm_label"] = selected.label
    return selected


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _hermetic_environment(request: Any) -> None:
    """Fail fast unless the instance satisfies the question set's invariants.

    The rubrics encode facts about the benchmark projects (which project has
    errors, how many models appear, whether the slowest span is unambiguous).
    Running against an instance where those don't hold produces a session that
    grades wrong answers as wrong questions. ``evals/mcp/seed.py`` recreates
    the canonical environment on any Phoenix; set
    ``MCP_BENCHMARK_SKIP_ENV_CHECK=1`` to run against a hand-curated instance
    at your own risk.

    For the ``tool_groups`` arm the agent reads a second, code-mode-off
    instance, so that endpoint is additionally checked to serve the same data
    as the primary — otherwise the arm would be graded against references it
    never saw.
    """
    if not _session_runs_benchmark(request):
        return
    if os.getenv("MCP_BENCHMARK_SKIP_ENV_CHECK", "").strip().lower() in {"1", "true", "yes", "on"}:
        return
    config: BenchmarkConfig = request.getfixturevalue("benchmark_config")
    problems = await verify_environment(config.base_url, config.api_key)
    if not problems and config.arm_name == "tool_groups":
        problems = await verify_mirror(config.base_url, config.tool_groups_url, config.api_key)
    if problems:
        raise pytest.UsageError(
            "benchmark environment is not set up:\n- "
            + "\n- ".join(problems)
            + "\nSeed it with: uv run python -m evals.mcp.seed"
            + "\n(or set MCP_BENCHMARK_SKIP_ENV_CHECK=1 to run against a "
            "hand-curated instance at your own risk)"
        )


@pytest_asyncio.fixture(scope="session")
async def ground_truth(benchmark_config: BenchmarkConfig) -> dict[str, Any]:
    """Reference answers, computed once per session from the REST API.

    Deliberately per-session rather than shared across a succession of arm
    sessions: the phoenix plugin's own experiment bootstrap mutates the
    instance (the benchmark dataset gains an experiment per session), so a
    reference computed after this session's bootstrap is consistent with what
    this session's agent sees, while a reused one silently would not be.
    """
    truth = await compute_ground_truth(benchmark_config.base_url, benchmark_config.api_key)
    _meta["ground_truth"] = truth
    return truth


@pytest_asyncio.fixture(scope="session", autouse=True)
async def catalog_probe(request: Any, _hermetic_environment: None) -> Optional[CatalogProbe]:
    """What the arm advertises on connect. Autouse: measured even for -k subsets.

    Depends on ``_hermetic_environment`` so an unseeded instance fails with the
    seed instruction rather than an arm connection error. Skipped (None) when
    the session runs no benchmark tests.
    """
    if not _session_runs_benchmark(request):
        return None
    arm: Arm = request.getfixturevalue("arm")
    probe = await probe_catalog(arm)
    _meta["catalog"] = asdict(probe)
    return probe


@pytest_asyncio.fixture(scope="session")
async def no_tools_baseline(benchmark_config: BenchmarkConfig) -> int:
    """Input tokens for system prompt + question alone; nets out of catalog cost."""
    tokens = await measure_no_tools_baseline(benchmark_config.model)
    _meta["no_tools_baseline"] = tokens
    return tokens


@pytest.fixture(scope="session", autouse=True)
def _agent_tracing(request: Any) -> Iterator[None]:
    """Send agent traces to Phoenix via OpenInference when MCP_BENCHMARK_TRACE is set.

    ``OpenInferenceSpanProcessor`` translates pydantic-ai's GenAI spans into
    OpenInference attributes, so it has to sit ahead of the exporter on the
    same provider.
    """
    if not _session_runs_benchmark(request):
        yield
        return
    benchmark_config: BenchmarkConfig = request.getfixturevalue("benchmark_config")
    if not benchmark_config.trace:
        yield
        return
    from openinference.instrumentation.pydantic_ai import OpenInferenceSpanProcessor
    from phoenix.otel import register
    from pydantic_ai import Agent
    from pydantic_ai.models.instrumented import InstrumentationSettings

    tracer_provider = register(
        project_name=benchmark_config.trace_project,
        endpoint=f"{benchmark_config.base_url.rstrip('/')}/v1/traces",
        auto_instrument=False,
        batch=True,
    )
    tracer_provider.add_span_processor(OpenInferenceSpanProcessor())
    Agent.instrument_all(InstrumentationSettings(tracer_provider=tracer_provider))
    yield
    tracer_provider.force_flush()


def pytest_runtest_logreport(report: Any) -> None:
    if report.when != "call":
        return
    for name, value in report.user_properties:
        if name == RECORD_PROPERTY_KEY:
            _runs.append(json.loads(value))


def pytest_sessionfinish(session: Any, exitstatus: Any) -> None:
    # Workers post their reports to the controller, which owns the single write.
    if hasattr(session.config, "workerinput"):
        return
    if not _runs:
        return
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    path = RESULTS_DIR / f"session-{_meta.get('arm', 'unknown')}-{stamp}.json"
    write_session(path, meta=_meta, runs=_runs)
    _meta["session_path"] = str(path)


def pytest_terminal_summary(terminalreporter: Any, exitstatus: int, config: Any) -> None:
    path: Optional[str] = _meta.get("session_path")
    if path is None:
        return
    correct = sum(1 for run in _runs if run.get("correct"))
    terminalreporter.write_line(
        f"MCP benchmark [{_meta.get('arm')}]: {correct}/{len(_runs)} correct -> {path}"
    )
    terminalreporter.write_line(
        "Compare arms: uv run python -m evals.mcp.report evals/mcp/results/session-*.json"
    )
