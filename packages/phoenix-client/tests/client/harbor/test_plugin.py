"""Tests for the Harbor lifecycle plugin's configuration and wiring."""

from __future__ import annotations

import contextlib
import logging
from collections.abc import AsyncIterator
from typing import Any, cast

import pytest

from phoenix.client.harbor import PhoenixJobPlugin
from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._model import DatasetIdentity, ExperimentSlice, JobPlan, TaskRecord
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
    trials=(),
    repetitions=1,
)


@pytest.fixture
def wired(monkeypatch: pytest.MonkeyPatch) -> FakeClient:
    """Run the plugin against fake Phoenix resources and a pre-resolved plan."""
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

    @pytest.mark.parametrize("trace_mode", ["atif", "otlp", "none"])
    def test_supported_trace_modes(self, trace_mode: TraceMode) -> None:
        assert PhoenixJobPlugin(trace_mode=trace_mode).trace_mode == trace_mode

    def test_unsupported_trace_mode_is_rejected_at_construction(self) -> None:
        """Harbor turns a plugin constructor error into a startup failure."""
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
        await plugin.on_job_start(object())

        assert plugin.snapshot is not None
        assert plugin.snapshot.example_ids == {"task-a": "node-a"}
        assert len(plugin.experiments) == 1
        assert wired.experiments.created[0]["dataset_version_id"] == "version-1"

    async def test_dataset_override_is_passed_to_the_adapter(
        self, monkeypatch: pytest.MonkeyPatch, wired: FakeClient
    ) -> None:
        seen: dict[str, Any] = {}

        def _build(job: Any, *, dataset_override: str | None = None) -> JobPlan:
            seen["override"] = dataset_override
            return PLAN

        monkeypatch.setattr("phoenix.client.harbor._plugin.build_job_plan", _build)
        await PhoenixJobPlugin(dataset="explicit").on_job_start(object())
        assert seen["override"] == "explicit"

    async def test_warns_that_trial_results_are_not_recorded_yet(
        self, wired: FakeClient, caplog: pytest.LogCaptureFixture
    ) -> None:
        with caplog.at_level(logging.WARNING, logger="phoenix.client.harbor._plugin"):
            await PhoenixJobPlugin(trace_mode="atif").on_job_start(object())
        assert "not recorded yet" in caplog.text
        assert "atif traces" in caplog.text

    async def test_a_phoenix_failure_stops_the_job(
        self, monkeypatch: pytest.MonkeyPatch, wired: FakeClient
    ) -> None:
        wired.datasets = FakeDatasets(RuntimeError("connection refused"))
        with pytest.raises(HarborPluginError, match="connection refused"):
            await PhoenixJobPlugin().on_job_start(object())


class TestJobEnd:
    async def test_is_a_no_op_when_the_job_never_started(self) -> None:
        await PhoenixJobPlugin().on_job_end(object())

    async def test_summarizes_the_recorded_job(
        self, wired: FakeClient, caplog: pytest.LogCaptureFixture
    ) -> None:
        plugin = PhoenixJobPlugin()
        await plugin.on_job_start(object())
        with caplog.at_level(logging.INFO, logger="phoenix.client.harbor._plugin"):
            await plugin.on_job_end(object())
        assert "phoenix-evals" in caplog.text
