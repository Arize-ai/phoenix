"""Tests for Harbor dataset and experiment recording."""

from __future__ import annotations

import builtins
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any

import httpx
import pytest

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


def task(task_id: str, digest: str = "sha256:" + "a" * 64, **overrides: Any) -> TaskRecord:
    defaults: dict[str, Any] = {
        "task_id": task_id,
        "name": task_id,
        "source": "phoenix-evals",
        "task_type": "local",
        "version": None,
        "digest": digest,
        "instruction": "do the thing",
    }
    return TaskRecord(**{**defaults, **overrides})


def slice_(agent_name: str = "claude-code", model: str | None = "sonnet", seed: str = "1") -> Any:
    return ExperimentSlice(
        identity_digest="sha256:" + seed * 64,
        agent_name=agent_name,
        model_name=model,
        import_path=None,
    )


def plan(*slices: ExperimentSlice, tasks: tuple[TaskRecord, ...] = (), **overrides: Any) -> JobPlan:
    defaults: dict[str, Any] = {
        "job_id": "job-1",
        "job_name": "2026-08-18__12-00-00",
        "harbor_version": "0.21.0",
        "dataset": DatasetIdentity(
            name="phoenix-evals", kind="local", inferred_name="phoenix-evals"
        ),
        "tasks": tasks or (task("task-a"),),
        "slices": slices or (slice_(),),
        "trials": (),
        "repetitions": 1,
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

    async def _upload_json_dataset(self, **kwargs: Any) -> FakeDataset:
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
    ) -> None:
        self.existing = existing or []
        self.runs = runs or []
        self.log_error = log_error
        self.created: list[dict[str, Any]] = []
        self.logged_runs: list[dict[str, Any]] = []

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
        if self.log_error is not None:
            raise self.log_error
        return {"id": f"run-{len(self.logged_runs)}", **kwargs}


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


def trial_result(*, trial_name: str = "task-a__1", error: Any = None) -> Any:
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id="trial-id",
        trial_name=trial_name,
        trial_uri="file:///trial",
        task_name="task-a",
        started_at=now,
        finished_at=now,
        exception_info=error,
        compute_token_cost_totals=lambda: (10, 2, 4, 0.01),
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
        assert call["dataset_name"] == "phoenix-evals"
        assert call["action"] == "update", "a full snapshot, not an append"
        assert call["example_ids"] == ["task-a"]
        assert call["inputs"] == [
            {"task_id": "task-a", "task_name": "task-a", "instruction": "do the thing"}
        ]
        assert call["outputs"] == [{}]
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
        assert handle.project_name == "Experiment-abc"

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
            experiment_name_template="{dataset}/{agent}",
        ).resolve_experiments(plan(), SNAPSHOT)
        assert experiments.created[0]["experiment_name"] == "phoenix-evals/claude-code"

    async def test_bad_template_lists_fields(self) -> None:
        with pytest.raises(HarborPluginError, match="Available fields"):
            await recorder(
                FakeClient(experiments=FakeExperiments()),
                experiment_name_template="{nope}",
            ).resolve_experiments(plan(), SNAPSHOT)

    async def test_missing_model_uses_default_in_name(self) -> None:
        experiments = FakeExperiments()
        await recorder(FakeClient(experiments=experiments)).resolve_experiments(
            plan(slice_(model=None)), SNAPSHOT
        )
        assert experiments.created[0]["experiment_name"].endswith("· default")


class TestRecordTrial:
    async def test_records_the_planned_repetition_without_rewards(self) -> None:
        experiments = FakeExperiments()
        job = plan(
            trials=(
                TrialSlot(
                    trial_name="task-a__2",
                    identity_digest=slice_().identity_digest,
                    task_id="task-a",
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

        await recorder(FakeClient(experiments=experiments)).record_trial(
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

    async def test_duplicate_conflict_reuses_the_matching_successful_run(self) -> None:
        request = httpx.Request("POST", "https://phoenix.example/v1/experiments/1/runs")
        conflict = httpx.HTTPStatusError(
            "duplicate",
            request=request,
            response=httpx.Response(409, request=request),
        )
        result = trial_result()
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
        experiments = FakeExperiments(runs=[existing_run], log_error=conflict)
        job = plan(
            trials=(
                TrialSlot(
                    trial_name="task-a__1",
                    identity_digest=slice_().identity_digest,
                    task_id="task-a",
                    repetition=1,
                ),
            )
        )
        client = FakeClient(experiments=experiments)
        handles = await recorder(client).resolve_experiments(job, SNAPSHOT)

        recorded = await recorder(client).record_trial(
            plan=job,
            snapshot=SNAPSHOT,
            experiments=handles,
            trial_result=result,
        )

        assert recorded == existing_run
