# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false, reportUnknownParameterType=false
# pyright: reportPrivateUsage=false
"""Tests for Harbor dataset and experiment recording."""

from __future__ import annotations

import builtins
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast

import httpx
import pytest

pytest.importorskip("harbor", reason="Harbor requires Python >=3.12")

from harbor.models.job.config import JobConfig
from harbor.models.job.lock import TaskLock
from harbor.models.trial.config import AgentConfig, TaskConfig, TrialConfig
from harbor.models.trial.result import TimingInfo, TrialResult

from phoenix.client.harbor import EXPERIMENT_NAME_TEMPLATE_FIELDS
from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._model import (
    DatasetIdentity,
    ExperimentSlice,
    JobPlan,
    StepRecord,
    TaskRecord,
    TrialSlot,
)
from phoenix.client.harbor._recorder import (
    DatasetSnapshot,
    PhoenixRecorder,
    experiment_identity,
)
from phoenix.client.harbor._scores import ExtractedEvaluation


def task(task_id: str, digest: str = "sha256:" + "a" * 64, **overrides: Any) -> TaskRecord:
    version = overrides.pop("version", None)
    source = overrides.pop("source", "phoenix-evals")
    task_type = overrides.pop("task_type", "local")
    defaults: dict[str, Any] = {
        "lock": TaskLock(
            name=task_id,
            version=version,
            source=source,
            type=task_type,
            digest=digest,
        ),
        "name": task_id,
        "instruction": "do the thing",
    }
    return TaskRecord(**{**defaults, **overrides})


def slice_(
    agent_name: str = "claude-code", model: str | None = "sonnet", seed: str = "1"
) -> ExperimentSlice:
    return ExperimentSlice(
        identity_digest="sha256:" + seed * 64,
        agent=AgentConfig(name=agent_name, model_name=model),
    )


def plan(*slices: ExperimentSlice, tasks: tuple[TaskRecord, ...] = (), **overrides: Any) -> JobPlan:
    repetitions = overrides.pop("repetitions", 1)
    job_name = overrides.pop("job_name", "2026-08-18__12-00-00")
    defaults: dict[str, Any] = {
        "job_id": "job-1",
        "harbor_version": "0.21.0",
        "config": JobConfig(
            job_name=job_name,
            n_attempts=repetitions,
            tasks=[TaskConfig(path=Path("task-a"))],
            agents=[experiment_slice.agent for experiment_slice in slices] or [slice_().agent],
        ),
        "dataset": DatasetIdentity(name="phoenix-evals", kind="local"),
        "tasks": tasks or (task("task-a"),),
        "slices": slices or (slice_(),),
        "trials": (),
    }
    return JobPlan(**{**defaults, **overrides})


class FakeDataset:
    def __init__(self, examples: list[dict[str, Any]], version_id: str = "version-1") -> None:
        self.id = "dataset-1"
        self.version_id = version_id
        self.examples = examples


class FakeDatasets:
    def __init__(self, dataset: FakeDataset | Exception) -> None:
        self._dataset = dataset
        self.calls: list[dict[str, Any]] = []

    async def create_dataset(self, **kwargs: Any) -> FakeDataset:
        self.calls.append(kwargs)
        if isinstance(self._dataset, Exception):
            raise self._dataset
        return self._dataset


class FakeExperiments:
    def __init__(
        self,
        existing: list[dict[str, Any]] | None = None,
        runs: list[dict[str, Any]] | None = None,
        log_error: Exception | None = None,
        log_errors: list[Exception | None] | None = None,
        evaluation_errors: list[Exception | None] | None = None,
    ) -> None:
        self.existing = existing or []
        self.runs = runs or []
        self.log_error = log_error
        self.log_errors = list(log_errors or [])
        self.evaluation_errors = list(evaluation_errors or [])
        self.created: list[dict[str, Any]] = []
        self.logged_runs: list[dict[str, Any]] = []
        self.logged_evaluations: list[dict[str, Any]] = []

    async def list(self, *, dataset_id: str) -> list[dict[str, Any]]:
        del dataset_id
        return self.existing

    async def create(self, **kwargs: Any) -> dict[str, Any]:
        self.created.append(kwargs)
        return {
            "id": f"experiment-{len(self.created)}",
            "name": kwargs.get("experiment_name"),
            "project_name": f"Experiment-{len(self.created)}",
            "dataset_version_id": kwargs.get("dataset_version_id"),
            "repetitions": kwargs.get("repetitions"),
        }

    async def _get_all_experiment_runs(
        self, *, experiment_id: str
    ) -> builtins.list[dict[str, Any]]:
        return [run for run in self.runs if run["experiment_id"] == experiment_id]

    async def log_run(self, **kwargs: Any) -> dict[str, Any]:
        self.logged_runs.append(kwargs)
        if self.log_errors:
            error = self.log_errors.pop(0)
            if error is not None:
                raise error
        if self.log_error is not None:
            raise self.log_error
        return {"id": f"run-{len(self.logged_runs)}", **kwargs}

    async def log_evaluation(self, **kwargs: Any) -> dict[str, Any]:
        self.logged_evaluations.append(kwargs)
        if self.evaluation_errors:
            error = self.evaluation_errors.pop(0)
            if error is not None:
                raise error
        return {"id": f"evaluation-{len(self.logged_evaluations)}"}


class FakeClient:
    def __init__(self, datasets: Any = None, experiments: Any = None) -> None:
        self.datasets = datasets
        self.experiments = experiments or FakeExperiments()


def recorder(client: Any, **kwargs: Any) -> PhoenixRecorder:
    return PhoenixRecorder(client, **kwargs)  # pyright: ignore[reportArgumentType]


def example_row(task_id: str, node_id: str) -> dict[str, Any]:
    return {
        "id": task_id,
        "node_id": node_id,
        "input": {},
        "output": {},
        "metadata": {"task_digest": "sha256:" + "a" * 64},
    }


def trial_result(
    *,
    trial_name: str = "task-a__1",
    error: Any = None,
    steps: list[Any] | None = None,
) -> TrialResult:
    now = datetime.now(timezone.utc)
    return cast(
        TrialResult,
        SimpleNamespace(
            id="trial-id",
            trial_name=trial_name,
            trial_uri="file:///trial",
            task_name="task-a",
            started_at=now,
            finished_at=now,
            environment_setup=None,
            agent_setup=None,
            agent_execution=None,
            verifier=None,
            verifier_result=None,
            step_results=steps,
            exception_info=error,
            compute_token_cost_totals=lambda: (10, 2, 4, 0.01),
        ),
    )


SNAPSHOT = DatasetSnapshot(
    dataset_id="dataset-1", version_id="version-1", example_ids={"task-a": "node-a"}
)


class TestExamplePayload:
    def test_example_matches_the_specified_shape(self) -> None:
        example = task("task-a", version="1.2.0").to_example()
        assert example["id"] == "task-a"
        assert example["input"] == {
            "task_id": "task-a",
            "task_name": "task-a",
            "instruction": "do the thing",
        }
        assert example["output"] == {}, "Harbor verifies end state, not a reference response"
        assert example["metadata"]["task_digest"] == "sha256:" + "a" * 64
        assert example["metadata"]["task_version"] == "1.2.0"

    def test_multi_step_tasks_carry_their_step_instructions(self) -> None:
        example = task(
            "task-a",
            instruction="",
            steps=(StepRecord("step_01", "aggregate"), StepRecord("step_02", "diagnose")),
        ).to_example()
        assert example["input"]["steps"] == [
            {"name": "step_01", "instruction": "aggregate"},
            {"name": "step_02", "instruction": "diagnose"},
        ]

    def test_single_step_tasks_omit_the_steps_key(self) -> None:
        assert "steps" not in task("task-a").to_example()["input"]


class TestSyncDataset:
    async def test_uploads_the_full_task_snapshot(self) -> None:
        datasets = FakeDatasets(FakeDataset([example_row("task-a", "node-a")]))
        snapshot = await recorder(FakeClient(datasets)).sync_dataset(plan())

        (call,) = datasets.calls
        assert call["name"] == "phoenix-evals"
        assert call["examples"] == [task("task-a").to_example()]
        assert snapshot == DatasetSnapshot("dataset-1", "version-1", {"task-a": "node-a"})

    async def test_missing_example_stops_the_job(self) -> None:
        datasets = FakeDatasets(FakeDataset([]))
        with pytest.raises(HarborPluginError, match="Missing Phoenix examples"):
            await recorder(FakeClient(datasets)).sync_dataset(plan())

    async def test_missing_version_stops_the_job(self) -> None:
        datasets = FakeDatasets(FakeDataset([example_row("task-a", "node-a")], version_id=""))
        with pytest.raises(HarborPluginError, match="returned no version"):
            await recorder(FakeClient(datasets)).sync_dataset(plan())

    async def test_upload_failure_is_reported_with_the_dataset_name(self) -> None:
        datasets = FakeDatasets(RuntimeError("connection refused"))
        with pytest.raises(HarborPluginError, match="phoenix-evals.*connection refused"):
            await recorder(FakeClient(datasets)).sync_dataset(plan())


class TestResolveExperiments:
    async def test_creates_one_experiment_per_agent_model(self) -> None:
        experiments = FakeExperiments()
        job = plan(slice_(model="sonnet", seed="1"), slice_(model="opus", seed="2"))
        handles = await recorder(FakeClient(experiments=experiments)).resolve_experiments(
            job, SNAPSHOT
        )

        assert len(handles) == 2
        assert [call["experiment_name"] for call in experiments.created] == [
            "2026-08-18__12-00-00 · claude-code · sonnet",
            "2026-08-18__12-00-00 · claude-code · opus",
        ]
        assert all(call["dataset_version_id"] == "version-1" for call in experiments.created)
        assert all(handle.created for handle in handles.values())

    async def test_experiment_records_harbors_attempt_count(self) -> None:
        experiments = FakeExperiments()
        await recorder(FakeClient(experiments=experiments)).resolve_experiments(
            plan(repetitions=4), SNAPSHOT
        )
        assert experiments.created[0]["repetitions"] == 4

    async def test_identity_metadata_is_stored_for_recovery(self) -> None:
        experiments = FakeExperiments()
        job = plan()
        await recorder(FakeClient(experiments=experiments)).resolve_experiments(job, SNAPSHOT)
        metadata = experiments.created[0]["experiment_metadata"]
        assert metadata["integration"] == "harbor"
        assert metadata["harbor_job_id"] == "job-1"
        assert metadata["harbor_identity_digest"] == experiment_identity(
            job, SNAPSHOT, job.slices[0]
        )

    async def test_replay_reuses_experiment(self) -> None:
        job = plan()
        identity = experiment_identity(job, SNAPSHOT, job.slices[0])
        experiments = FakeExperiments(
            [
                {
                    "id": "experiment-existing",
                    "name": "recorded earlier",
                    "project_name": "Experiment-abc",
                    "dataset_version_id": "version-1",
                    "repetitions": 1,
                    "metadata": {"integration": "harbor", "harbor_identity_digest": identity},
                }
            ]
        )
        handles = await recorder(FakeClient(experiments=experiments)).resolve_experiments(
            job, SNAPSHOT
        )

        assert experiments.created == []
        handle = handles[job.slices[0].identity_digest]
        assert (handle.experiment_id, handle.created) == ("experiment-existing", False)

    async def test_unrelated_experiments_on_the_dataset_are_ignored(self) -> None:
        experiments = FakeExperiments(
            [
                {"id": "other", "metadata": {"source": "notebook"}},
                {"id": "no-metadata", "metadata": None},
            ]
        )
        await recorder(FakeClient(experiments=experiments)).resolve_experiments(plan(), SNAPSHOT)
        assert len(experiments.created) == 1

    async def test_duplicate_identity_lists_ids(self) -> None:
        job = plan()
        identity = experiment_identity(job, SNAPSHOT, job.slices[0])
        metadata = {"integration": "harbor", "harbor_identity_digest": identity}
        experiments = FakeExperiments(
            [{"id": "one", "metadata": metadata}, {"id": "two", "metadata": metadata}]
        )
        with pytest.raises(HarborPluginError, match="one, two"):
            await recorder(FakeClient(experiments=experiments)).resolve_experiments(job, SNAPSHOT)

    async def test_repetition_mismatch_rejects_recovery(self) -> None:
        job = plan(repetitions=2)
        identity = experiment_identity(job, SNAPSHOT, job.slices[0])
        experiments = FakeExperiments(
            [
                {
                    "id": "experiment-existing",
                    "dataset_version_id": "version-1",
                    "repetitions": 5,
                    "metadata": {"integration": "harbor", "harbor_identity_digest": identity},
                }
            ]
        )
        with pytest.raises(HarborPluginError, match="repetition"):
            await recorder(FakeClient(experiments=experiments)).resolve_experiments(job, SNAPSHOT)


class TestExperimentIdentity:
    def test_job_id_separates_identity(self) -> None:
        first, second = plan(), plan(job_id="job-2")
        assert experiment_identity(first, SNAPSHOT, first.slices[0]) != experiment_identity(
            second, SNAPSHOT, second.slices[0]
        )

    def test_a_changed_task_set_is_a_separate_experiment(self) -> None:
        job = plan()
        other = DatasetSnapshot("dataset-1", "version-2", {"task-a": "node-a"})
        assert experiment_identity(job, SNAPSHOT, job.slices[0]) != experiment_identity(
            job, other, job.slices[0]
        )

    async def test_two_jobs_can_use_the_same_exact_display_name(self) -> None:
        first_experiments = FakeExperiments()
        second_experiments = FakeExperiments()
        first = plan(job_id="job-1")
        second = plan(job_id="job-2")

        await recorder(
            FakeClient(experiments=first_experiments), experiment_name="baseline"
        ).resolve_experiments(first, SNAPSHOT)
        await recorder(
            FakeClient(experiments=second_experiments), experiment_name="baseline"
        ).resolve_experiments(second, SNAPSHOT)

        first_created = first_experiments.created[0]
        second_created = second_experiments.created[0]
        assert first_created["experiment_name"] == second_created["experiment_name"] == "baseline"
        assert (
            first_created["experiment_metadata"]["harbor_identity_digest"]
            != second_created["experiment_metadata"]["harbor_identity_digest"]
        )


class TestExperimentNames:
    async def test_colliding_names_get_digest_suffix(self) -> None:
        experiments = FakeExperiments()
        job = plan(slice_(seed="1"), slice_(seed="2"))
        await recorder(FakeClient(experiments=experiments)).resolve_experiments(job, SNAPSHOT)

        names = [call["experiment_name"] for call in experiments.created]
        assert len(set(names)) == 2
        assert all(
            name.startswith("2026-08-18__12-00-00 · claude-code · sonnet · ") for name in names
        )

    async def test_template_is_configurable(self) -> None:
        experiments = FakeExperiments()
        await recorder(
            FakeClient(experiments=experiments),
            experiment_name_template="{dataset.name}/{agent.name}",
        ).resolve_experiments(plan(), SNAPSHOT)
        assert experiments.created[0]["experiment_name"] == "phoenix-evals/claude-code"

    async def test_all_template_namespaces_are_available(self) -> None:
        experiments = FakeExperiments()
        await recorder(
            FakeClient(experiments=experiments),
            experiment_name_template=(
                "{job.id}/{job.name}/{dataset.name}/{agent.name}/{agent.model}/{agent.short_digest}"
            ),
        ).resolve_experiments(plan(), SNAPSHOT)

        assert experiments.created[0]["experiment_name"] == (
            "job-1/2026-08-18__12-00-00/phoenix-evals/claude-code/sonnet/111111111111"
        )

    def test_bad_template_lists_fields_at_construction(self) -> None:
        with pytest.raises(ValueError, match="Available fields"):
            recorder(
                FakeClient(experiments=FakeExperiments()),
                experiment_name_template="{nope}",
            )

    async def test_exact_name_is_used_for_one_slice(self) -> None:
        experiments = FakeExperiments()
        await recorder(
            FakeClient(experiments=experiments),
            experiment_name="{literal baseline}",
        ).resolve_experiments(plan(), SNAPSHOT)

        assert experiments.created[0]["experiment_name"] == "{literal baseline}"

    async def test_exact_name_rejects_multiple_slices(self) -> None:
        experiments = FakeExperiments()
        job = plan(slice_(model="sonnet", seed="1"), slice_(model="opus", seed="2"))

        with pytest.raises(HarborPluginError, match="one experiment slice"):
            await recorder(
                FakeClient(experiments=experiments),
                experiment_name="baseline",
            ).resolve_experiments(job, SNAPSHOT)

        assert experiments.created == []

    def test_public_field_catalog_describes_the_supported_fields(self) -> None:
        assert tuple(EXPERIMENT_NAME_TEMPLATE_FIELDS) == (
            "job.name",
            "job.id",
            "dataset.name",
            "agent.name",
            "agent.model",
            "agent.short_digest",
        )

    async def test_missing_model_uses_default_in_name(self) -> None:
        experiments = FakeExperiments()
        await recorder(FakeClient(experiments=experiments)).resolve_experiments(
            plan(slice_(model=None)), SNAPSHOT
        )
        assert experiments.created[0]["experiment_name"].endswith("· default")


class TestRecordExperimentRun:
    def test_phase_timings_do_not_change_run_reuse_identity(self) -> None:
        result = trial_result()
        started_at = cast(datetime, result.started_at)
        result.environment_setup = TimingInfo(
            started_at=started_at,
            finished_at=started_at + timedelta(seconds=1.5),
        )
        # Phase timings are intentionally excluded from immutable run output so a
        # resumed job can reuse a run written before those timings were available.
        existing_run = {
            "id": "run-existing",
            "output": {
                "harbor_trial_id": "trial-id",
                "harbor_trial_name": "task-a__1",
                "harbor_trial_uri": "file:///trial",
                "task_name": "task-a",
                "token_usage": {"input": 10, "cache": 2, "output": 4},
                "cost_usd": 0.01,
            },
        }

        assert PhoenixRecorder.can_reuse_run(cast(Any, existing_run), trial_result=result)

    async def test_records_the_planned_repetition_without_rewards(self) -> None:
        experiments = FakeExperiments()
        job = plan(
            trials=(
                TrialSlot(
                    config=TrialConfig(
                        task=TaskConfig(path=Path("task-a")),
                        agent=slice_().agent,
                        trial_name="task-a__2",
                    ),
                    identity_digest=slice_().identity_digest,
                    repetition=2,
                ),
            ),
            repetitions=2,
        )
        handle = {
            job.slices[0].identity_digest: (
                await recorder(FakeClient(experiments=experiments)).resolve_experiments(
                    job, SNAPSHOT
                )
            )[job.slices[0].identity_digest]
        }
        result = trial_result(trial_name="task-a__2")

        await recorder(FakeClient(experiments=experiments)).record_experiment_run(
            plan=job,
            snapshot=SNAPSHOT,
            experiments=handle,
            trial_result=result,
        )

        (logged,) = experiments.logged_runs
        assert logged["dataset_example_id"] == "node-a"
        assert logged["repetition_number"] == 2
        assert logged["error"] is None
        assert logged["output"]["harbor_trial_id"] == "trial-id"
        assert "reward" not in logged["output"]

    @pytest.mark.parametrize(
        ("has_verifier_result", "expected_error"),
        [
            (False, "step build: StepError: failed"),
            (True, None),
        ],
        ids=["fatal-step-error", "non-fatal-step-error"],
    )
    async def test_only_fatal_step_errors_mark_the_experiment_run_failed(
        self,
        has_verifier_result: bool,
        expected_error: str | None,
    ) -> None:
        experiments = FakeExperiments()
        job = plan(
            trials=(
                TrialSlot(
                    config=TrialConfig(
                        task=TaskConfig(path=Path("task-a")),
                        agent=slice_().agent,
                        trial_name="task-a__1",
                    ),
                    identity_digest=slice_().identity_digest,
                    repetition=1,
                ),
            )
        )
        handles = await recorder(FakeClient(experiments=experiments)).resolve_experiments(
            job, SNAPSHOT
        )
        step_result = SimpleNamespace(
            step_name="build",
            exception_info=SimpleNamespace(
                exception_type="StepError",
                exception_message="failed",
            ),
            verifier_result=SimpleNamespace(rewards={"accuracy": 0.5})
            if has_verifier_result
            else None,
        )

        await recorder(FakeClient(experiments=experiments)).record_experiment_run(
            plan=job,
            snapshot=SNAPSHOT,
            experiments=handles,
            trial_result=trial_result(steps=[step_result]),
        )

        assert experiments.logged_runs[0]["error"] == expected_error

    async def test_duplicate_conflict_reuses_matching_successful_run(self) -> None:
        request = httpx.Request("POST", "https://phoenix.example/v1/experiments/1/runs")
        conflict = httpx.HTTPStatusError(
            "duplicate",
            request=request,
            response=httpx.Response(409, request=request),
        )
        existing_run = {
            "id": "run-existing",
            "experiment_id": "experiment-1",
            "dataset_example_id": "node-a",
            "repetition_number": 1,
            "output": {
                "harbor_trial_id": "trial-id",
                "harbor_trial_name": "task-a__1",
                "harbor_trial_uri": "file:///trial",
                "task_name": "task-a",
                "token_usage": {"input": 10, "cache": 2, "output": 4},
                "cost_usd": 0.01,
            },
        }
        experiments = FakeExperiments(
            runs=[existing_run],
            log_error=conflict,
        )
        job = plan(
            trials=(
                TrialSlot(
                    config=TrialConfig(
                        task=TaskConfig(path=Path("task-a")),
                        agent=slice_().agent,
                        trial_name="task-a__1",
                    ),
                    identity_digest=slice_().identity_digest,
                    repetition=1,
                ),
            )
        )
        client = FakeClient(experiments=experiments)
        handles = await recorder(client).resolve_experiments(job, SNAPSHOT)
        recorded = await recorder(client).record_experiment_run(
            plan=job,
            snapshot=SNAPSHOT,
            experiments=handles,
            trial_result=trial_result(),
        )

        assert recorded == existing_run
        assert len(experiments.logged_runs) == 1


class TestRecordEvaluations:
    @staticmethod
    def records() -> tuple[ExtractedEvaluation, ...]:
        now = datetime.now(timezone.utc)
        return (
            ExtractedEvaluation(
                name="reward",
                score=1.0,
                start_time=now,
                end_time=now,
                metadata={"harbor_trial_id": "trial-id"},
            ),
            ExtractedEvaluation(
                name="infra_ok",
                score=1.0,
                label="ok",
                start_time=now,
                end_time=now,
                metadata={"harbor_trial_id": "trial-id"},
            ),
        )

    async def test_logs_each_record_as_a_code_evaluation(self) -> None:
        experiments = FakeExperiments()

        await recorder(FakeClient(experiments=experiments)).record_evaluations(
            "run-1", self.records()
        )

        assert [call["name"] for call in experiments.logged_evaluations] == [
            "reward",
            "infra_ok",
        ]
        assert all(call["experiment_run_id"] == "run-1" for call in experiments.logged_evaluations)
        assert all(call["annotator_kind"] == "CODE" for call in experiments.logged_evaluations)
        assert "error" not in experiments.logged_evaluations[0]
