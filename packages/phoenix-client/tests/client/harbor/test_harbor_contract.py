# pyright: reportArgumentType=false, reportMissingImports=false, reportMissingTypeStubs=false
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false
"""Contract tests against a real Harbor installation.

The adapter reads Harbor's private job-plan attributes because Harbor exposes
no public API for the resolved plan. These tests resolve a real ``Job`` and
assert the plugin can still map it, so a Harbor refactor fails here rather than
mid-job. They build the job offline: ``Job.create`` resolves, downloads, and
plans without starting an environment.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from phoenix.client.harbor._adapter import build_job_plan
from phoenix.client.harbor._errors import HarborPluginError

pytest.importorskip("harbor", reason="Harbor requires Python >=3.12")

TASK_TOML = """schema_version = "1.3"

[task]
name = "arize/triage"
description = "A Harbor task fixture with steps and an environment secret."

[environment.env]
ANTHROPIC_API_KEY = "${ANTHROPIC_API_KEY:-}"

[[steps]]
name = "step_01_aggregate"

[[steps]]
name = "step_02_diagnose"
"""

STEP_NAMES = ("step_01_aggregate", "step_02_diagnose")


@pytest.fixture(scope="module")
def dataset_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A local Harbor dataset holding one multi-step task."""
    dataset = tmp_path_factory.mktemp("harbor") / "phoenix-evals"
    task = dataset / "triage"
    (task / "environment").mkdir(parents=True)
    (task / "environment" / "Dockerfile").write_text("FROM alpine\n")
    (task / "tests").mkdir()
    (task / "tests" / "test.sh").write_text("#!/bin/sh\nexit 0\n")
    (task / "task.toml").write_text(TASK_TOML)
    for step_name in STEP_NAMES:
        step = task / "steps" / step_name
        (step / "tests").mkdir(parents=True)
        (step / "instruction.md").write_text(f"Complete {step_name}.\n")
        (step / "tests" / "test.sh").write_text("#!/bin/sh\nexit 0\n")
    return dataset


def job_config(dataset_dir: Path, tmp_path: Path, **overrides: Any) -> Any:
    from harbor.models.job.config import DatasetConfig, JobConfig
    from harbor.models.trial.config import AgentConfig

    return JobConfig(
        jobs_dir=tmp_path / "jobs",
        datasets=[DatasetConfig(path=dataset_dir)],
        agents=overrides.pop("agents", [AgentConfig(name="oracle")]),
        **overrides,
    )


async def make_job(config: Any) -> Any:
    from harbor.job import Job

    return await Job.create(config)


class TestPluginRegistration:
    async def test_harbor_loads_the_plugin_by_entry_point_name(self) -> None:
        from harbor.cli.job_plugins import attach_job_plugin

        # ``object()`` is a Job stand-in: the adapter's first read fails, which
        # is enough to show Harbor resolved, constructed, and invoked us.
        with pytest.raises(HarborPluginError, match="does not expose `config`"):
            await attach_job_plugin(object(), "phoenix", kwargs={"trace_mode": "none"})

    async def test_plugin_satisfies_harbors_protocol(self) -> None:
        from harbor.models.job.plugin import JobPlugin

        from phoenix.client.harbor import PhoenixJobPlugin

        assert isinstance(PhoenixJobPlugin(trace_mode="none"), JobPlugin)


class TestResolvedPlan:
    async def test_maps_a_real_job_plan(self, dataset_dir: Path, tmp_path: Path) -> None:
        job = await make_job(job_config(dataset_dir, tmp_path))
        plan = build_job_plan(job)

        assert plan.job_id == str(job.id)
        assert plan.dataset.kind == "local"
        assert plan.dataset.name == "phoenix-evals", "local datasets are named by directory"
        assert len(plan.tasks) == 1
        assert len(plan.trials) == len(job), "one slot per planned Harbor trial"

    async def test_task_carries_a_harbor_digest_and_step_instructions(
        self, dataset_dir: Path, tmp_path: Path
    ) -> None:
        plan = build_job_plan(await make_job(job_config(dataset_dir, tmp_path)))
        (task,) = plan.tasks

        assert task.task_id == "triage", "local tasks are identified by directory"
        assert task.name == "arize/triage", "declared name, not the ID"
        assert task.digest.startswith("sha256:") and len(task.digest) == 71
        assert [step.name for step in task.steps] == list(STEP_NAMES)
        assert all(step.instruction for step in task.steps)

    async def test_digest_matches_harbors_own_job_lock(
        self, dataset_dir: Path, tmp_path: Path
    ) -> None:
        """The plugin hashes each task once; Harbor hashes once per trial."""
        from harbor.models.job.lock import build_job_lock

        job = await make_job(job_config(dataset_dir, tmp_path, n_attempts=2))
        plan = build_job_plan(job)
        lock = build_job_lock(
            config=job.config,
            trial_configs=job._trial_configs,  # noqa: SLF001
            task_download_results=job._task_download_results,  # noqa: SLF001
        )
        assert {task.digest for task in plan.tasks} == {trial.task.digest for trial in lock.trials}

    async def test_example_never_contains_task_environment_secrets(
        self, dataset_dir: Path, tmp_path: Path
    ) -> None:
        plan = build_job_plan(await make_job(job_config(dataset_dir, tmp_path)))
        environment = plan.tasks[0].to_example()["metadata"]["task_config"]["environment"]
        assert environment["env"] == sorted(environment["env"])
        assert all(isinstance(name, str) for name in environment["env"])
        assert "ANTHROPIC_API_KEY" in environment["env"]

    async def test_repetitions_follow_harbors_attempt_count(
        self, dataset_dir: Path, tmp_path: Path
    ) -> None:
        from harbor.models.trial.config import AgentConfig

        job = await make_job(
            job_config(
                dataset_dir,
                tmp_path,
                n_attempts=3,
                agents=[AgentConfig(name="oracle"), AgentConfig(name="oracle", model_name="x")],
            )
        )
        plan = build_job_plan(job)

        assert plan.repetitions == 3
        assert len(plan.slices) == 2, "one experiment per agent/model configuration"
        assert len(plan.trials) == 6
        assert sorted(slot.repetition for slot in plan.trials) == [1, 1, 2, 2, 3, 3]
        assert (
            len({(slot.identity_digest, slot.task_id, slot.repetition) for slot in plan.trials})
            == 6
        )
        assert {slot.trial_name for slot in plan.trials} == {
            trial_config.trial_name
            for trial_config in job._trial_configs  # noqa: SLF001
        }

    async def test_resolved_trial_names_are_stable_identifiers(
        self, dataset_dir: Path, tmp_path: Path
    ) -> None:
        """Trial UUIDs do not exist until a trial starts; names do."""
        job = await make_job(job_config(dataset_dir, tmp_path))
        plan = build_job_plan(job)
        assert all(slot.trial_name for slot in plan.trials)


class TestRejectedJobShapes:
    async def test_ad_hoc_tasks_alongside_a_dataset_are_rejected(
        self, dataset_dir: Path, tmp_path: Path
    ) -> None:
        from harbor.models.trial.config import TaskConfig

        config = job_config(dataset_dir, tmp_path)
        config.tasks = [TaskConfig(path=dataset_dir / "triage")]
        with pytest.raises(HarborPluginError, match="ad-hoc"):
            build_job_plan(await make_job(config))

    async def test_multiple_datasets_are_rejected(self, dataset_dir: Path, tmp_path: Path) -> None:
        from harbor.models.job.config import DatasetConfig

        config = job_config(dataset_dir, tmp_path)
        config.datasets = [DatasetConfig(path=dataset_dir), DatasetConfig(path=dataset_dir)]
        with pytest.raises(HarborPluginError, match="exactly one Harbor dataset"):
            build_job_plan(await make_job(config))
