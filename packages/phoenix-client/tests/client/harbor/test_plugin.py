"""Tests for the Harbor plugin."""

from __future__ import annotations

import contextlib
import logging
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, cast

import pytest

from phoenix.client.harbor import PhoenixJobPlugin
from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._model import (
    DatasetIdentity,
    ExperimentSlice,
    JobPlan,
    TaskRecord,
    TrialSlot,
)
from phoenix.client.harbor._plugin import TraceMode

from .test_recorder import FakeClient, FakeDataset, FakeDatasets, FakeExperiments, example_row

PLAN = JobPlan(
    job_id="job-1",
    job_name="2026-08-18__12-00-00",
    harbor_version="0.21.0",
    dataset=DatasetIdentity(name="phoenix-evals", kind="local", inferred_name="phoenix-evals"),
    tasks=(
        TaskRecord(
            task_id="task-a",
            name="task-a",
            source="phoenix-evals",
            task_type="local",
            version=None,
            digest="sha256:" + "a" * 64,
            instruction="do the thing",
        ),
    ),
    slices=(
        ExperimentSlice(
            identity_digest="sha256:" + "1" * 64,
            agent_name="claude-code",
            model_name="sonnet",
            import_path=None,
        ),
    ),
    trials=(
        TrialSlot(
            trial_name="task-a__1",
            identity_digest="sha256:" + "1" * 64,
            task_id="task-a",
            repetition=1,
        ),
    ),
    repetitions=1,
)


class FakeJob:
    def __init__(self, *, max_retries: int = 0) -> None:
        self.config = SimpleNamespace(
            retry=SimpleNamespace(
                max_retries=max_retries,
                include_exceptions=[],
                exclude_exceptions=[],
            )
        )
        self.started_hook: Any = None
        self.ended_hook: Any = None

    def on_trial_started(self, callback: Any) -> None:
        self.started_hook = callback

    def on_trial_ended(self, callback: Any) -> None:
        self.ended_hook = callback


def trial_result(*, error: Any = None) -> Any:
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id="trial-id",
        trial_name="task-a__1",
        trial_uri="file:///trial",
        task_name="task-a",
        started_at=now,
        finished_at=now,
        exception_info=error,
        compute_token_cost_totals=lambda: (None, None, None, None),
    )


@pytest.fixture
def wired(monkeypatch: pytest.MonkeyPatch) -> FakeClient:
    client = FakeClient(
        datasets=FakeDatasets(FakeDataset([example_row("task-a", "node-a")])),
        experiments=FakeExperiments(),
    )

    @contextlib.asynccontextmanager
    async def _open_client(self: PhoenixJobPlugin) -> AsyncIterator[Any]:
        del self
        yield client

    monkeypatch.setattr(
        "phoenix.client.harbor._plugin.build_job_plan",
        lambda job, *, dataset_override=None: PLAN,
    )
    monkeypatch.setattr(PhoenixJobPlugin, "_open_client", _open_client)
    return client


class TestConfiguration:
    def test_defaults(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PHOENIX_COLLECTOR_ENDPOINT", "https://phoenix.example")
        plugin = PhoenixJobPlugin()
        assert plugin.trace_mode == "atif"
        assert plugin.dataset is None
        assert "{agent}" in plugin.experiment_name_template

    def test_unsupported_trace_mode_is_rejected_at_construction(self) -> None:
        with pytest.raises(ValueError, match="unsupported trace_mode"):
            PhoenixJobPlugin(trace_mode=cast(TraceMode, "otel"))

    def test_explicit_endpoint_overrides_the_environment(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PHOENIX_COLLECTOR_ENDPOINT", "https://from-env.example")
        assert PhoenixJobPlugin(endpoint="https://explicit.example").endpoint == (
            "https://explicit.example"
        )


class TestJobStart:
    async def test_records_the_dataset_and_experiments(self, wired: FakeClient) -> None:
        plugin = PhoenixJobPlugin()
        job = FakeJob()
        await plugin.on_job_start(job)

        assert plugin.snapshot is not None
        assert plugin.snapshot.example_ids == {"task-a": "node-a"}
        assert len(plugin.experiments) == 1
        assert wired.experiments.created[0]["dataset_version_id"] == "version-1"
        assert job.started_hook is not None
        assert job.ended_hook is not None

    async def test_dataset_override_is_passed_to_the_adapter(
        self, monkeypatch: pytest.MonkeyPatch, wired: FakeClient
    ) -> None:
        seen: dict[str, Any] = {}

        def _build(job: Any, *, dataset_override: str | None = None) -> JobPlan:
            seen["override"] = dataset_override
            return PLAN

        monkeypatch.setattr("phoenix.client.harbor._plugin.build_job_plan", _build)
        await PhoenixJobPlugin(dataset="explicit").on_job_start(FakeJob())
        assert seen["override"] == "explicit"

    async def test_a_phoenix_failure_stops_the_job(
        self, monkeypatch: pytest.MonkeyPatch, wired: FakeClient
    ) -> None:
        wired.datasets = FakeDatasets(RuntimeError("connection refused"))
        with pytest.raises(HarborPluginError, match="connection refused"):
            await PhoenixJobPlugin().on_job_start(FakeJob())

    async def test_terminal_trial_is_recorded_as_an_experiment_run(self, wired: FakeClient) -> None:
        plugin = PhoenixJobPlugin()
        job = FakeJob()
        await plugin.on_job_start(job)
        result = trial_result()

        await job.started_hook(SimpleNamespace(trial_name=result.trial_name))
        await job.ended_hook(SimpleNamespace(trial_name=result.trial_name, result=result))

        (logged,) = wired.experiments.logged_runs
        assert logged["repetition_number"] == 1
        assert logged["dataset_example_id"] == "node-a"

    async def test_retryable_attempt_is_not_recorded(self, wired: FakeClient) -> None:
        plugin = PhoenixJobPlugin()
        job = FakeJob(max_retries=1)
        await plugin.on_job_start(job)
        error = SimpleNamespace(exception_type="TimeoutError", exception_message="timed out")
        result = trial_result(error=error)

        await job.started_hook(SimpleNamespace(trial_name=result.trial_name))
        await job.ended_hook(SimpleNamespace(trial_name=result.trial_name, result=result))

        assert wired.experiments.logged_runs == []


class TestJobEnd:
    async def test_summarizes_the_recorded_job(
        self, wired: FakeClient, caplog: pytest.LogCaptureFixture
    ) -> None:
        plugin = PhoenixJobPlugin()
        await plugin.on_job_start(FakeJob())
        with caplog.at_level(logging.INFO, logger="phoenix.client.harbor._plugin"):
            await plugin.on_job_end(SimpleNamespace(trial_results=[]))
        assert "phoenix-evals" in caplog.text
