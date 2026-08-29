# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false
# pyright: reportPrivateUsage=false
"""Contract tests against a real Harbor installation."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast

import pytest

pytest.importorskip("harbor", reason="Harbor requires Python >=3.12")

from phoenix.client.harbor._adapter import build_job_plan, existing_trial_results
from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._scores import extract_evaluations

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
        from harbor.job import Job

        # The first adapter read proves Harbor loaded and called the plugin.
        with pytest.raises(HarborPluginError, match="expected `harbor.job.Job`"):
            await attach_job_plugin(
                cast(Job, object()), "arize-phoenix", kwargs={"trace_mode": "none"}
            )

    async def test_plugin_satisfies_harbors_protocol(self) -> None:
        from harbor.models.job.plugin import BaseJobPlugin, JobPlugin

        from phoenix.client.harbor import PhoenixJobPlugin

        assert issubclass(PhoenixJobPlugin, BaseJobPlugin)
        plugin: JobPlugin = PhoenixJobPlugin(trace_mode="none")
        assert isinstance(plugin, JobPlugin)


class TestResolvedPlan:
    async def test_maps_a_real_job_plan(self, dataset_dir: Path, tmp_path: Path) -> None:
        job = await make_job(job_config(dataset_dir, tmp_path))
        plan = build_job_plan(job)

        assert plan.job_id == str(job.id)
        assert plan.dataset.kind == "local"
        assert plan.dataset.name == "phoenix-evals", "local datasets are named by directory"
        (task,) = plan.tasks
        assert len(plan.trials) == len(job), "one slot per planned Harbor trial"
        assert task.task_id == "triage", "local tasks are identified by directory"
        assert task.name == "arize/triage", "declared name, not the ID"
        assert task.digest.startswith("sha256:") and len(task.digest) == 71
        assert [step.name for step in task.steps] == list(STEP_NAMES)
        assert all(step.instruction for step in task.steps)
        assert task.multi_step_reward_strategy == "mean", "multi-step tasks default to mean"
        assert all(slot.trial_name for slot in plan.trials)
        assert existing_trial_results(job) == ()
        environment = task.to_example()["metadata"]["task_config"]["environment"]
        assert environment["env"] == ["ANTHROPIC_API_KEY"]

    async def test_digest_matches_harbors_own_job_lock(
        self, dataset_dir: Path, tmp_path: Path
    ) -> None:
        from harbor.models.job.lock import build_job_lock

        job = await make_job(job_config(dataset_dir, tmp_path, n_attempts=2))
        plan = build_job_plan(job)
        lock = build_job_lock(
            config=job.config,
            trial_configs=job._trial_configs,  # noqa: SLF001
            task_download_results=job._task_download_results,  # noqa: SLF001
        )
        assert {task.digest for task in plan.tasks} == {trial.task.digest for trial in lock.trials}

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

    async def test_maps_a_direct_task_path(self, dataset_dir: Path, tmp_path: Path) -> None:
        from harbor.models.job.config import JobConfig
        from harbor.models.trial.config import AgentConfig, TaskConfig

        task_dir = dataset_dir / "triage"
        job = await make_job(
            JobConfig(
                jobs_dir=tmp_path / "jobs",
                tasks=[TaskConfig(path=task_dir)],
                agents=[AgentConfig(name="oracle")],
            )
        )
        plan = build_job_plan(job)

        assert plan.dataset.name == "harbor-task/arize/triage"
        assert plan.dataset.kind == "adhoc"
        assert [task.task_id for task in plan.tasks] == ["triage"]


@pytest.mark.parametrize(
    ("rewards", "expected_names"),
    [
        (None, {"infra_ok"}),
        ({}, {"infra_ok"}),
        ({"reward": 0.5}, {"reward", "infra_ok"}),
        ({"reward": 0.5, "tool_calls": 3}, {"reward", "tool_calls", "infra_ok"}),
        ({"accuracy": 0.8}, {"accuracy", "infra_ok"}),
        ({"accuracy": 0.8, "tool_calls": 3}, {"accuracy", "tool_calls", "infra_ok"}),
    ],
)
def test_trial_reward_names_match_harbors_verifier_output(
    rewards: dict[str, float | int] | None,
    expected_names: set[str],
) -> None:
    from harbor.models.trial.result import TrialResult
    from harbor.models.verifier.result import VerifierResult

    now = datetime.now(timezone.utc)
    trial = cast(
        TrialResult,
        SimpleNamespace(
            id="trial-id",
            trial_name="task-a__1",
            task_name="task-a",
            started_at=now,
            finished_at=now,
            verifier=None,
            verifier_result=(VerifierResult(rewards=rewards) if rewards is not None else None),
            exception_info=None,
            step_results=None,
        ),
    )

    extracted = {record.name: record.score for record in extract_evaluations(trial)}
    assert set(extracted) == expected_names
