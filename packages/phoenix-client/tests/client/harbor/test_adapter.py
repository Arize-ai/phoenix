"""Unit tests for Harbor plan conversion."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from phoenix.client.harbor._adapter import (
    _agent_identity_digest,  # pyright: ignore[reportPrivateUsage]
    _build_slices,  # pyright: ignore[reportPrivateUsage]
    _build_task_records,  # pyright: ignore[reportPrivateUsage]
    _build_trial_slots,  # pyright: ignore[reportPrivateUsage]
    _redact_env,  # pyright: ignore[reportPrivateUsage]
    _resolve_adhoc_dataset_identity,  # pyright: ignore[reportPrivateUsage]
    _resolve_dataset_identity,  # pyright: ignore[reportPrivateUsage]
    _TaskContent,  # pyright: ignore[reportPrivateUsage]
    _validate_job_shape,  # pyright: ignore[reportPrivateUsage]
)
from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._model import TaskRecord


def agent(**overrides: Any) -> Any:
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
    return SimpleNamespace(**{**defaults, **overrides})


def task_record(task_id: str, source: str | None = "phoenix-evals") -> TaskRecord:
    return TaskRecord(
        task_id=task_id,
        name=task_id,
        source=source,
        task_type="local",
        version=None,
        digest="sha256:" + "0" * 64,
        instruction="do the thing",
    )


def dataset_config(**flags: bool) -> Any:
    return SimpleNamespace(
        is_local=lambda: flags.get("local", False),
        is_registry=lambda: flags.get("registry", False),
        is_package=lambda: flags.get("package", False),
        is_repo=lambda: flags.get("repo", False),
    )


def trial(agent_config: Any, task_id: str, trial_name: str) -> Any:
    return SimpleNamespace(
        agent=agent_config,
        trial_name=trial_name,
        task=SimpleNamespace(get_task_id=lambda: SimpleNamespace(get_name=lambda: task_id)),
    )


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


class TestTaskRecords:
    def test_task_lock_version_is_optional_for_harbor_before_0_21(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        task_config = SimpleNamespace(source="phoenix-evals")
        task_lock = SimpleNamespace(
            name="task-a",
            type="local",
            digest="sha256:" + "0" * 64,
        )
        content = _TaskContent(
            name="arize/task-a",
            instruction="do the thing",
            steps=(),
            config={},
        )
        monkeypatch.setattr(
            "phoenix.client.harbor._adapter._lookup_download",
            lambda task_config, downloads: SimpleNamespace(path="/unused"),
        )
        monkeypatch.setattr(
            "phoenix.client.harbor._adapter._build_task_lock",
            lambda task_config, download: task_lock,
        )
        monkeypatch.setattr(
            "phoenix.client.harbor._adapter._read_task_content",
            lambda task_dir: content,
        )

        (record,) = _build_task_records([task_config], {})

        assert record.version is None


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
        _validate_job_shape(
            SimpleNamespace(source_jobs=[], tasks=[object()], datasets=[], agents=[object()])
        )


class TestDatasetIdentity:
    def test_name_is_inferred_from_the_resolved_task_source(self) -> None:
        identity = _resolve_dataset_identity(
            dataset_config(registry=True), [task_record("a"), task_record("b")], None
        )
        assert (identity.name, identity.kind, identity.inferred_name) == (
            "phoenix-evals",
            "registry",
            "phoenix-evals",
        )

    def test_override_wins_and_the_inferred_name_is_kept(self) -> None:
        identity = _resolve_dataset_identity(
            dataset_config(local=True), [task_record("a")], "my-dataset"
        )
        assert (identity.name, identity.inferred_name) == ("my-dataset", "phoenix-evals")

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
        assert (identity.name, identity.kind, identity.inferred_name) == (
            "harbor-task/task-id",
            "adhoc",
            "harbor-task/task-id",
        )

    def test_multiple_ad_hoc_tasks_require_an_override(self) -> None:
        with pytest.raises(HarborPluginError, match="plugin-kwarg dataset"):
            _resolve_adhoc_dataset_identity([task_record("one"), task_record("two")], None)

    def test_override_names_a_multiple_task_synthetic_dataset(self) -> None:
        identity = _resolve_adhoc_dataset_identity(
            [task_record("one"), task_record("two")],
            "pxi-regression",
        )
        assert (identity.name, identity.inferred_name) == ("pxi-regression", None)


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
