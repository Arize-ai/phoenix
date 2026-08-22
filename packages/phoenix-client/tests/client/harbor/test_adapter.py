# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false, reportUnknownParameterType=false
"""Unit tests for Harbor plan conversion."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast

import pytest

pytest.importorskip("harbor", reason="Harbor requires Python >=3.12")

from harbor.models.job.config import DatasetConfig, JobConfig
from harbor.models.job.lock import TaskLock
from harbor.models.trial.config import AgentConfig, TaskConfig, TrialConfig

from phoenix.client.harbor._adapter import (
    MINIMUM_HARBOR_VERSION,
    _agent_identity_digest,  # pyright: ignore[reportPrivateUsage]
    _build_slices,  # pyright: ignore[reportPrivateUsage]
    _build_trial_slots,  # pyright: ignore[reportPrivateUsage]
    _redact_env,  # pyright: ignore[reportPrivateUsage]
    _require_supported_harbor,  # pyright: ignore[reportPrivateUsage]
    _resolve_adhoc_dataset_identity,  # pyright: ignore[reportPrivateUsage]
    _resolve_dataset_identity,  # pyright: ignore[reportPrivateUsage]
    _validate_job_shape,  # pyright: ignore[reportPrivateUsage]
)
from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._model import TaskRecord


def agent(**overrides: Any) -> AgentConfig:
    defaults: dict[str, Any] = {
        "name": "claude-code",
        "import_path": None,
        "model_name": "anthropic/claude-sonnet-4-5",
        "skills": [],
        "kwargs": {},
        "env": {},
        "mcp_servers": [],
        "override_timeout_sec": None,
        "override_setup_timeout_sec": None,
        "max_timeout_sec": None,
        "resume_trajectory": False,
        "load_trajectory": None,
        "extra_allowed_hosts": [],
        "n_concurrent": None,
        "concurrency_group": None,
        "include_logs": [],
        "exclude_logs": [],
    }
    return AgentConfig(**{**defaults, **overrides})


def task_record(task_id: str, source: str | None = "phoenix-evals") -> TaskRecord:
    return TaskRecord(
        lock=TaskLock(
            name=task_id,
            type="local",
            source=source,
            digest="sha256:" + "0" * 64,
        ),
        name=task_id,
        instruction="do the thing",
    )


def dataset_config(**flags: bool) -> DatasetConfig:
    if flags.get("local"):
        return DatasetConfig(path=Path("phoenix-evals"))
    if flags.get("registry"):
        return DatasetConfig(name="phoenix-evals")
    if flags.get("package"):
        return DatasetConfig(name="arize/phoenix-evals")
    if flags.get("repo"):
        return DatasetConfig(repo="Arize-ai/phoenix", path=Path("evals/harbor"))
    return cast(
        DatasetConfig,
        SimpleNamespace(
            is_local=lambda: flags.get("local", False),
            is_registry=lambda: flags.get("registry", False),
            is_package=lambda: flags.get("package", False),
            is_repo=lambda: flags.get("repo", False),
        ),
    )


def trial(agent_config: AgentConfig, task_id: str, trial_name: str) -> TrialConfig:
    return TrialConfig(
        agent=agent_config,
        trial_name=trial_name,
        task=TaskConfig(path=Path(task_id)),
    )


class TestHarborVersion:
    def test_client_extra_matches_the_runtime_minimum(self) -> None:
        pyproject = Path(__file__).parents[3] / "pyproject.toml"
        minimum = ".".join(str(part) for part in MINIMUM_HARBOR_VERSION)

        assert f'"harbor>={minimum};' in pyproject.read_text()

    def test_accepts_major_versions_above_the_minimum(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr("phoenix.client.harbor._adapter.harbor.__version__", "1.0.0")

        assert _require_supported_harbor() == "1.0.0"

    def test_rejects_versions_below_the_minimum(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr("phoenix.client.harbor._adapter.harbor.__version__", "0.21.0rc1")

        with pytest.raises(HarborPluginError, match=r"harbor>=0\.21\.0"):
            _require_supported_harbor()


class TestAgentIdentity:
    def test_behavioral_fields_separate_experiments(self) -> None:
        assert _agent_identity_digest(agent()) != _agent_identity_digest(
            agent(model_name="openai/gpt-5")
        )
        assert _agent_identity_digest(agent()) != _agent_identity_digest(
            agent(skills=["arize/phoenix-cli"])
        )
        assert _agent_identity_digest(agent()) != _agent_identity_digest(
            agent(kwargs={"temperature": 0.2})
        )

    def test_scheduling_and_logging_fields_do_not_separate_experiments(self) -> None:
        baseline = _agent_identity_digest(agent())
        assert _agent_identity_digest(agent(n_concurrent=4)) == baseline
        assert _agent_identity_digest(agent(concurrency_group="pool")) == baseline
        assert _agent_identity_digest(agent(include_logs=["*.log"])) == baseline

    def test_env_values_are_excluded_but_env_keys_are_not(self) -> None:
        rotated = _agent_identity_digest(agent(env={"API_KEY": "old"}))
        assert rotated == _agent_identity_digest(agent(env={"API_KEY": "new"}))
        assert rotated != _agent_identity_digest(agent(env={"API_KEY": "old", "EXTRA": "1"}))


class TestSlices:
    def test_readable_identity_excludes_secret_bearing_fields(self) -> None:
        (experiment_slice,) = _build_slices([agent(env={"API_KEY": "secret"})])
        described = experiment_slice.describe()
        assert "secret" not in repr(described)
        assert described["agent_name"] == "claude-code"
        assert described["model_name"] == "anthropic/claude-sonnet-4-5"

    def test_duplicate_agent_configurations_are_rejected(self) -> None:
        with pytest.raises(HarborPluginError, match="Duplicate agent configuration"):
            _build_slices([agent(), agent()])


class TestJobShape:
    @pytest.mark.parametrize(
        ("config", "message"),
        [
            (SimpleNamespace(source_jobs=["job"], tasks=[], datasets=[1], agents=[1]), "Regrade"),
            (
                SimpleNamespace(source_jobs=[], tasks=["t"], datasets=[1], agents=[1]),
                "cannot combine",
            ),
            (
                SimpleNamespace(source_jobs=[], tasks=[], datasets=[1, 2], agents=[1]),
                "at most one",
            ),
            (SimpleNamespace(source_jobs=[], tasks=[], datasets=[], agents=[1]), "neither"),
            (SimpleNamespace(source_jobs=[], tasks=[], datasets=[1], agents=[]), "no agents"),
        ],
    )
    def test_rejects_unsupported_shapes(self, config: Any, message: str) -> None:
        with pytest.raises(HarborPluginError, match=message):
            _validate_job_shape(config)

    def test_accepts_ad_hoc_tasks_without_a_dataset(self) -> None:
        _validate_job_shape(JobConfig(tasks=[TaskConfig(path=Path("task-a"))], agents=[agent()]))


class TestDatasetIdentity:
    @pytest.mark.parametrize(
        ("config", "source", "expected_name", "expected_kind"),
        [
            (dataset_config(local=True), "task-source", "phoenix-evals", "local"),
            (dataset_config(registry=True), "task-source", "phoenix-evals", "registry"),
            (
                dataset_config(package=True),
                "task-source",
                "arize/phoenix-evals",
                "package",
            ),
            (dataset_config(repo=True), "repo-dataset", "repo-dataset", "repo"),
        ],
    )
    def test_name_follows_the_configured_dataset_source(
        self,
        config: DatasetConfig,
        source: str,
        expected_name: str,
        expected_kind: str,
    ) -> None:
        identity = _resolve_dataset_identity(config, [task_record("a", source)], None)
        assert (identity.name, identity.kind) == (expected_name, expected_kind)

    def test_override_wins(self) -> None:
        identity = _resolve_dataset_identity(
            dataset_config(local=True), [task_record("a")], "my-dataset"
        )
        assert identity.name == "my-dataset"

    def test_mixed_sources_are_rejected(self) -> None:
        with pytest.raises(HarborPluginError, match="multiple dataset sources"):
            _resolve_dataset_identity(
                dataset_config(local=True),
                [task_record("a", "one"), task_record("b", "two")],
                None,
            )

    def test_missing_name_asks_for_the_override(self) -> None:
        with pytest.raises(HarborPluginError, match="plugin-kwarg dataset"):
            _resolve_dataset_identity(dataset_config(), [task_record("a", None)], None)

    def test_override_rescues_a_dataset_harbor_could_not_name(self) -> None:
        identity = _resolve_dataset_identity(dataset_config(), [task_record("a", None)], "named")
        assert identity.name == "named"

    def test_single_ad_hoc_task_uses_a_namespaced_declared_name(self) -> None:
        identity = _resolve_adhoc_dataset_identity([task_record("task-id")], None)
        assert (identity.name, identity.kind) == ("harbor-task/task-id", "adhoc")

    def test_multiple_ad_hoc_tasks_require_an_override(self) -> None:
        with pytest.raises(HarborPluginError, match="plugin-kwarg dataset"):
            _resolve_adhoc_dataset_identity([task_record("one"), task_record("two")], None)

    def test_override_names_a_multiple_task_synthetic_dataset(self) -> None:
        identity = _resolve_adhoc_dataset_identity(
            [task_record("one"), task_record("two")],
            "pxi-regression",
        )
        assert identity.name == "pxi-regression"


class TestRepetitions:
    def test_repetitions_follow_plan_order_not_completion_order(self) -> None:
        one, two = agent(), agent(model_name="openai/gpt-5")
        slices = _build_slices([one, two])
        trial_configs = [
            trial(agent_config, task_id, f"{task_id}__{attempt}{agent_config.model_name}")
            for attempt in range(2)
            for task_id in ("task-a", "task-b")
            for agent_config in (one, two)
        ]
        slots = _build_trial_slots(trial_configs, slices)

        assert [slot.repetition for slot in slots] == [1, 1, 1, 1, 2, 2, 2, 2]
        assert min(slot.repetition for slot in slots) == 1, "Phoenix rejects repetition 0"
        assert len({(s.identity_digest, s.task_id, s.repetition) for s in slots}) == len(slots)

    def test_unknown_agent_configuration_is_rejected(self) -> None:
        slices = _build_slices([agent()])
        with pytest.raises(HarborPluginError, match="missing from the job configuration"):
            _build_trial_slots([trial(agent(model_name="other"), "task-a", "t")], slices)


class TestRedaction:
    def test_env_values_are_replaced_by_their_key_names(self) -> None:
        redacted = _redact_env(
            {
                "environment": {"env": {"ANTHROPIC_API_KEY": "sk-secret", "MODE": "fast"}},
                "steps": [{"name": "one", "agent": {"env": {"TOKEN": "t"}}}],
            }
        )
        assert redacted["environment"]["env"] == ["ANTHROPIC_API_KEY", "MODE"]
        assert redacted["steps"][0]["agent"]["env"] == ["TOKEN"]
        assert "sk-secret" not in repr(redacted)
