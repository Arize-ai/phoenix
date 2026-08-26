# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false, reportUnknownParameterType=false
# pyright: reportUntypedBaseClass=false
"""Tests for the Harbor plugin."""

from __future__ import annotations

import contextlib
import logging
from collections.abc import AsyncIterator
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast

import pytest

pytest.importorskip("harbor", reason="Harbor requires Python >=3.12")

from harbor.job import Job
from harbor.models.job.config import JobConfig, RetryConfig
from harbor.models.job.lock import TaskLock
from harbor.models.job.result import JobResult
from harbor.models.trial.config import AgentConfig, TaskConfig, TrialConfig
from harbor.models.trial.result import TrialResult
from harbor.models.verifier.result import VerifierResult
from harbor.trial.hooks import HookCallback, TrialHookEvent

from phoenix.client.harbor import DEFAULT_EXPERIMENT_NAME_TEMPLATE, PhoenixJobPlugin
from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._model import (
    DatasetIdentity,
    ExperimentSlice,
    JobPlan,
    StepRecord,
    TaskRecord,
    TrialSlot,
)

from .test_recorder import FakeClient, FakeDataset, FakeDatasets, FakeExperiments, example_row

PLAN_AGENT = AgentConfig(name="claude-code", model_name="sonnet")
PLAN_TASK = TaskConfig(path=Path("task-a"), source="phoenix-evals")
PLAN = JobPlan(
    job_id="job-1",
    harbor_version="0.21.0",
    config=JobConfig(
        job_name="2026-08-18__12-00-00",
        tasks=[PLAN_TASK],
        agents=[PLAN_AGENT],
    ),
    dataset=DatasetIdentity(name="phoenix-evals", kind="local"),
    tasks=(
        TaskRecord(
            lock=TaskLock(
                name="task-a",
                type="local",
                source="phoenix-evals",
                digest="sha256:" + "a" * 64,
            ),
            name="task-a",
            instruction="do the thing",
        ),
    ),
    slices=(
        ExperimentSlice(
            identity_digest="sha256:" + "1" * 64,
            agent=PLAN_AGENT,
        ),
    ),
    trials=(
        TrialSlot(
            config=TrialConfig(
                task=PLAN_TASK,
                agent=PLAN_AGENT,
                trial_name="task-a__1",
            ),
            identity_digest="sha256:" + "1" * 64,
            repetition=1,
        ),
    ),
)


class FakeJob(Job):
    def __init__(self, *, max_retries: int = 0, existing: tuple[Any, ...] = ()) -> None:
        self.config = JobConfig(
            tasks=[PLAN_TASK],
            agents=[PLAN_AGENT],
            retry=RetryConfig(
                max_retries=max_retries,
                include_exceptions=set(),
                exclude_exceptions=set(),
            ),
        )
        self._existing_trial_results = list(existing)
        self.started_hook: HookCallback | None = None
        self.ended_hook: HookCallback | None = None

    def on_trial_started(self, callback: HookCallback) -> Job:
        self.started_hook = callback
        return self

    def on_trial_ended(self, callback: HookCallback) -> Job:
        self.ended_hook = callback
        return self


def trial_result(*, error: Any = None, rewards: dict[str, float] | None = None) -> TrialResult:
    now = datetime.now(timezone.utc)
    return cast(
        TrialResult,
        SimpleNamespace(
            id="trial-id",
            trial_name="task-a__1",
            trial_uri="file:///trial",
            task_name="task-a",
            started_at=now,
            finished_at=now,
            environment_setup=None,
            agent_setup=None,
            agent_execution=None,
            verifier=None,
            verifier_result=(VerifierResult(rewards=rewards) if rewards is not None else None),
            step_results=None,
            exception_info=error,
            compute_token_cost_totals=lambda: (None, None, None, None),
        ),
    )


def hook_event(result: TrialResult) -> TrialHookEvent:
    return cast(
        TrialHookEvent,
        SimpleNamespace(trial_name=result.trial_name, result=result),
    )


def require_hook(hook: HookCallback | None) -> HookCallback:
    assert hook is not None
    return hook


def successful_run(result: Any, **overrides: Any) -> dict[str, Any]:
    defaults: dict[str, Any] = {
        "id": "run-existing",
        "experiment_id": "experiment-1",
        "dataset_example_id": "node-a",
        "repetition_number": 1,
        "output": {
            "harbor_trial_id": result.id,
            "harbor_trial_name": result.trial_name,
            "harbor_trial_uri": result.trial_uri,
            "task_name": result.task_name,
        },
    }
    return {**defaults, **overrides}


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

    def _build_plan(job: Any, *, dataset_override: str | None = None) -> JobPlan:
        del job, dataset_override
        return PLAN

    monkeypatch.setattr(
        "phoenix.client.harbor._plugin.build_job_plan",
        _build_plan,
    )
    monkeypatch.setattr(PhoenixJobPlugin, "_open_client", _open_client)
    return client


class TestConfiguration:
    def test_defaults(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PHOENIX_COLLECTOR_ENDPOINT", "https://phoenix.example")
        plugin = PhoenixJobPlugin()
        assert plugin.dataset is None
        assert plugin.experiment_name is None
        assert plugin.experiment_name_template == DEFAULT_EXPERIMENT_NAME_TEMPLATE

    def test_exact_name_and_template_are_mutually_exclusive(self) -> None:
        with pytest.raises(ValueError, match="mutually exclusive"):
            PhoenixJobPlugin(
                experiment_name="baseline",
                experiment_name_template="{job.name}",
            )

    @pytest.mark.parametrize("value", ["", "   "])
    def test_empty_exact_name_is_rejected(self, value: str) -> None:
        with pytest.raises(ValueError, match="must not be empty"):
            PhoenixJobPlugin(experiment_name=value)

    def test_unknown_template_field_is_rejected_at_construction(self) -> None:
        with pytest.raises(ValueError, match=r"agent\.model_name.*agent\.model"):
            PhoenixJobPlugin(experiment_name_template="{agent.model_name}")

    def test_flat_template_fields_are_not_supported(self) -> None:
        with pytest.raises(ValueError, match="'agent'"):
            PhoenixJobPlugin(experiment_name_template="{agent}")

    @pytest.mark.parametrize("trace_mode", ["atif", "otlp", "otel"])
    def test_unsupported_trace_mode_is_rejected_at_construction(self, trace_mode: str) -> None:
        with pytest.raises(ValueError, match="Only trace_mode='none' is available"):
            PhoenixJobPlugin(trace_mode=cast(Any, trace_mode))

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

    @pytest.mark.parametrize("step_name", ["reward", "infra_ok", "verifier"])
    async def test_reserved_evaluation_names_are_allowed_as_step_names(
        self,
        step_name: str,
        monkeypatch: pytest.MonkeyPatch,
        wired: FakeClient,
    ) -> None:
        valid_plan = replace(
            PLAN,
            tasks=(replace(PLAN.tasks[0], steps=(StepRecord(step_name, "check"),)),),
        )

        def _build(job: object, *, dataset_override: str | None = None) -> JobPlan:
            del job, dataset_override
            return valid_plan

        monkeypatch.setattr("phoenix.client.harbor._plugin.build_job_plan", _build)

        await PhoenixJobPlugin().on_job_start(FakeJob())

        assert len(wired.datasets.calls) == 1

    @pytest.mark.parametrize(
        "steps",
        [
            (StepRecord("", "check"),),
            (StepRecord("repeated", "first"), StepRecord("repeated", "second")),
        ],
        ids=["empty", "duplicate"],
    )
    async def test_invalid_step_names_stop_before_upload(
        self,
        steps: tuple[StepRecord, ...],
        monkeypatch: pytest.MonkeyPatch,
        wired: FakeClient,
    ) -> None:
        invalid_plan = replace(
            PLAN,
            tasks=(replace(PLAN.tasks[0], steps=steps),),
        )

        def _build(job: object, *, dataset_override: str | None = None) -> JobPlan:
            del job, dataset_override
            return invalid_plan

        monkeypatch.setattr("phoenix.client.harbor._plugin.build_job_plan", _build)

        with pytest.raises(HarborPluginError, match="empty step name|repeats step name"):
            await PhoenixJobPlugin().on_job_start(FakeJob())

        assert wired.datasets.calls == []

    async def test_exact_name_is_used_for_one_experiment_slice(self, wired: FakeClient) -> None:
        await PhoenixJobPlugin(experiment_name="{literal baseline}").on_job_start(FakeJob())

        assert wired.experiments.created[0]["experiment_name"] == "{literal baseline}"

    async def test_exact_name_rejects_multiple_experiment_slices_before_upload(
        self, monkeypatch: pytest.MonkeyPatch, wired: FakeClient
    ) -> None:
        second_agent = AgentConfig(name="claude-code", model_name="opus")
        second_slice = ExperimentSlice(
            identity_digest="sha256:" + "2" * 64,
            agent=second_agent,
        )
        multi_slice_plan = replace(PLAN, slices=(*PLAN.slices, second_slice))

        def _build(job: object, *, dataset_override: str | None = None) -> JobPlan:
            del job, dataset_override
            return multi_slice_plan

        monkeypatch.setattr(
            "phoenix.client.harbor._plugin.build_job_plan",
            _build,
        )

        with pytest.raises(HarborPluginError, match="one experiment slice"):
            await PhoenixJobPlugin(experiment_name="baseline").on_job_start(FakeJob())

        assert wired.datasets.calls == []

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

        await require_hook(job.started_hook)(hook_event(result))
        await require_hook(job.ended_hook)(hook_event(result))

        (logged,) = wired.experiments.logged_runs
        assert logged["repetition_number"] == 1
        assert logged["dataset_example_id"] == "node-a"
        assert [evaluation["name"] for evaluation in wired.experiments.logged_evaluations] == [
            "infra_ok"
        ]

    async def test_multi_step_strategy_reaches_trial_reward_metadata(
        self,
        monkeypatch: pytest.MonkeyPatch,
        wired: FakeClient,
    ) -> None:
        multi_step_plan = replace(
            PLAN,
            tasks=(
                replace(
                    PLAN.tasks[0],
                    steps=(StepRecord("grade", "check"),),
                    multi_step_reward_strategy="final",
                ),
            ),
        )

        def _build(job: object, *, dataset_override: str | None = None) -> JobPlan:
            del job, dataset_override
            return multi_step_plan

        monkeypatch.setattr("phoenix.client.harbor._plugin.build_job_plan", _build)
        plugin = PhoenixJobPlugin()
        job = FakeJob()
        await plugin.on_job_start(job)
        await require_hook(job.ended_hook)(hook_event(trial_result(rewards={"accuracy": 0.8})))

        accuracy = next(
            evaluation
            for evaluation in wired.experiments.logged_evaluations
            if evaluation["name"] == "accuracy"
        )
        assert accuracy["metadata"] == {
            "harbor_trial_id": "trial-id",
            "multi_step_reward_strategy": "final",
        }

    async def test_retryable_attempt_is_not_recorded(self, wired: FakeClient) -> None:
        plugin = PhoenixJobPlugin()
        job = FakeJob(max_retries=1)
        await plugin.on_job_start(job)
        error = SimpleNamespace(exception_type="TimeoutError", exception_message="timed out")
        result = trial_result(error=error)

        await require_hook(job.started_hook)(hook_event(result))
        await require_hook(job.ended_hook)(hook_event(result))

        assert wired.experiments.logged_runs == []

    async def test_resume_write_failure_stops_before_registering_hooks(
        self, wired: FakeClient
    ) -> None:
        result = trial_result()
        job = FakeJob(existing=(result,))
        wired.experiments.log_error = RuntimeError("connection lost")

        with pytest.raises(HarborPluginError, match="connection lost"):
            await PhoenixJobPlugin().on_job_start(job)

        assert len(wired.experiments.logged_runs) == 1
        assert job.started_hook is None
        assert job.ended_hook is None

    async def test_resume_reuses_run_and_upserts_evaluations(self, wired: FakeClient) -> None:
        result = trial_result(rewards={"reward": 1.0})
        wired.experiments.runs = [successful_run(result)]

        await PhoenixJobPlugin().on_job_start(FakeJob(existing=(result,)))

        assert wired.experiments.logged_runs == []
        assert [evaluation["name"] for evaluation in wired.experiments.logged_evaluations] == [
            "reward",
            "infra_ok",
        ]

    async def test_resume_rejects_a_conflicting_successful_run(self, wired: FakeClient) -> None:
        result = trial_result()
        wired.experiments.runs = [
            successful_run(result, output={"harbor_trial_id": "different-trial"})
        ]

        with pytest.raises(HarborPluginError, match="does not match"):
            await PhoenixJobPlugin().on_job_start(FakeJob(existing=(result,)))

    async def test_resume_replaces_a_failed_run(self, wired: FakeClient) -> None:
        result = trial_result()
        wired.experiments.runs = [successful_run(result, error="previous failure")]

        await PhoenixJobPlugin().on_job_start(FakeJob(existing=(result,)))

        assert len(wired.experiments.logged_runs) == 1

    async def test_first_terminal_write_failure_disables_later_callbacks(
        self, wired: FakeClient
    ) -> None:
        wired.experiments.log_error = RuntimeError("connection lost")
        plugin = PhoenixJobPlugin()
        job = FakeJob()
        await plugin.on_job_start(job)
        event = hook_event(trial_result())

        with pytest.raises(HarborPluginError, match="connection lost"):
            await require_hook(job.ended_hook)(event)
        await require_hook(job.ended_hook)(event)

        assert len(wired.experiments.logged_runs) == 1

    async def test_evaluation_write_failure_sets_the_terminal_failure_flag(
        self, wired: FakeClient
    ) -> None:
        evaluation_errors: list[Exception | None] = [RuntimeError("evaluation rejected")]
        wired.experiments.evaluation_errors = evaluation_errors
        plugin = PhoenixJobPlugin()
        job = FakeJob()
        await plugin.on_job_start(job)
        event = hook_event(trial_result(rewards={"reward": 1.0}))

        with pytest.raises(HarborPluginError, match="evaluation rejected"):
            await require_hook(job.ended_hook)(event)
        await require_hook(job.ended_hook)(event)

        assert plugin._terminal_failure is not None  # noqa: SLF001  # pyright: ignore[reportPrivateUsage]
        assert len(wired.experiments.logged_runs) == 1
        assert len(wired.experiments.logged_evaluations) == 1


class TestJobEnd:
    async def test_summarizes_the_recorded_job(
        self, wired: FakeClient, caplog: pytest.LogCaptureFixture
    ) -> None:
        plugin = PhoenixJobPlugin()
        await plugin.on_job_start(FakeJob())
        with caplog.at_level(logging.INFO, logger="phoenix.client.harbor._plugin"):
            await plugin.on_job_end(cast(JobResult, SimpleNamespace(trial_results=[])))
        assert "phoenix-evals" in caplog.text
