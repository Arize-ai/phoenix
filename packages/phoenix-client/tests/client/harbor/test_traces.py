# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false, reportUnknownParameterType=false
# pyright: reportPrivateUsage=false
"""Tests for deterministic Harbor ATIF trace construction."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast

import pytest

pytest.importorskip("harbor", reason="Harbor requires Python >=3.12")

from harbor.models.job.config import JobConfig
from harbor.models.job.lock import TaskLock
from harbor.models.trial.config import AgentConfig, TaskConfig, TrialConfig
from harbor.models.trial.result import TrialResult

from phoenix.client.harbor._model import (
    DatasetIdentity,
    ExperimentSlice,
    JobPlan,
    TaskRecord,
    TrialSlot,
)
from phoenix.client.harbor._traces import build_harbor_trace

NOW = "2026-08-26T12:00:00+00:00"
AGENT = AgentConfig(name="terminus-2", model_name="gpt-5-mini")
TASK_CONFIG = TaskConfig(path=Path("task-a"))


def trajectory(*, session_id: str = "producer-session") -> dict[str, Any]:
    return {
        "schema_version": "ATIF-v1.7",
        "session_id": session_id,
        "trajectory_id": "producer-trajectory",
        "agent": {"name": "terminus-2", "version": "0.22.0"},
        "steps": [
            {"step_id": 1, "timestamp": NOW, "source": "user", "message": "Fix it"},
            {
                "step_id": 2,
                "timestamp": NOW,
                "source": "agent",
                "message": "Done",
                "llm_call_count": 1,
            },
        ],
    }


def context(
    tmp_path: Path,
    *,
    step_names: tuple[str, ...] = (),
    resume_trajectory: bool = False,
    simulated_user: bool = False,
) -> tuple[JobPlan, TrialSlot, TaskRecord, TrialResult]:
    trial_config = TrialConfig(
        task=TASK_CONFIG,
        agent=AgentConfig(
            name=AGENT.name,
            model_name=AGENT.model_name,
            resume_trajectory=resume_trajectory,
        ),
        trial_name="task-a__1",
        trials_dir=tmp_path,
    )
    task = TaskRecord(
        lock=TaskLock(
            name="task-a",
            type="local",
            source=None,
            digest="sha256:" + "a" * 64,
        ),
        name="Task A",
        instruction="Fix it",
    )
    experiment_slice = ExperimentSlice(identity_digest="sha256:" + "1" * 64, agent=AGENT)
    slot = TrialSlot(
        config=trial_config, identity_digest=experiment_slice.identity_digest, repetition=1
    )
    plan = JobPlan(
        job_id="job-1",
        harbor_version="0.22.0",
        config=JobConfig(tasks=[TASK_CONFIG], agents=[AGENT]),
        dataset=DatasetIdentity(name="tasks", kind="local"),
        tasks=(task,),
        slices=(experiment_slice,),
        trials=(slot,),
    )
    now = datetime.fromisoformat(NOW).astimezone(timezone.utc)
    steps = [SimpleNamespace(step_name=name, exception_info=None) for name in step_names] or None
    result = cast(
        TrialResult,
        SimpleNamespace(
            id="trial-id",
            config=(
                SimpleNamespace(
                    trials_dir=trial_config.trials_dir,
                    agent=trial_config.agent,
                    user_agent=object(),
                )
                if simulated_user
                else trial_config
            ),
            trial_name="task-a__1",
            task_name="task-a",
            started_at=now,
            finished_at=now,
            exception_info=None,
            step_results=steps,
        ),
    )
    return plan, slot, task, result


def write(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value))


def build(tmp_path: Path, **kwargs: Any) -> Any:
    plan, slot, task, result = context(tmp_path, **kwargs)
    return build_harbor_trace(
        plan=plan,
        slot=slot,
        task=task,
        trial_result=result,
        run_output={"harbor_trial_id": "trial-id"},
    )


def test_single_step_builds_one_stable_chain_root(tmp_path: Path) -> None:
    source = trajectory()
    write(tmp_path / "task-a__1/agent/trajectory.json", source)
    write(tmp_path / "task-a__1/agent/trajectory.stale.json", trajectory(session_id="stale"))

    first = build(tmp_path)
    second = build(tmp_path)

    assert first is not None and second is not None
    assert first == second
    assert first.source_paths == ("agent/trajectory.json",)
    assert first.spans[0]["name"] == "harbor.trial"
    assert first.spans[0]["span_kind"] == "CHAIN"
    assert all(span["context"]["trace_id"] == first.trace_id for span in first.spans)
    assert all(
        span.get("parent_id") in {item["context"]["span_id"] for item in first.spans}
        for span in first.spans[1:]
    )
    assert json.loads((tmp_path / "task-a__1/agent/trajectory.json").read_text()) == source


def test_multi_step_uses_only_attempted_steps_in_result_order(tmp_path: Path) -> None:
    write(tmp_path / "task-a__1/steps/prepare/agent/trajectory.json", trajectory())
    write(
        tmp_path / "task-a__1/steps/solve/agent/trajectory.json",
        trajectory(session_id="same-producer-session"),
    )
    write(tmp_path / "task-a__1/steps/unattempted/agent/trajectory.json", trajectory())

    result = build(tmp_path, step_names=("prepare", "solve"))

    assert result is not None
    assert result.source_paths == (
        "steps/prepare/agent/trajectory.json",
        "steps/solve/agent/trajectory.json",
    )
    ids = [span["context"]["span_id"] for span in result.spans]
    assert len(ids) == len(set(ids))


def test_native_resume_uses_last_cumulative_snapshot(tmp_path: Path) -> None:
    write(tmp_path / "task-a__1/steps/prepare/agent/trajectory.json", trajectory())
    write(tmp_path / "task-a__1/steps/solve/agent/trajectory.json", trajectory())

    result = build(
        tmp_path,
        step_names=("prepare", "solve"),
        resume_trajectory=True,
    )

    assert result is not None
    assert result.source_paths == ("steps/solve/agent/trajectory.json",)


def test_simulated_user_and_primary_agent_share_one_trace(tmp_path: Path) -> None:
    write(tmp_path / "task-a__1/agent/trajectory.json", trajectory())
    write(
        tmp_path / "task-a__1/user-agent/trajectory.json",
        trajectory(session_id="user-agent-session"),
    )

    result = build(tmp_path, simulated_user=True)

    assert result is not None
    assert result.source_paths == (
        "agent/trajectory.json",
        "user-agent/trajectory.json",
    )
    assert len([span for span in result.spans if span["span_kind"] == "AGENT"]) == 2


def test_continuation_chain_is_discovered(tmp_path: Path) -> None:
    root = trajectory()
    root["continued_trajectory_ref"] = "trajectory.cont-1.json"
    continuation = trajectory(session_id="producer-session-cont-1")
    write(tmp_path / "task-a__1/agent/trajectory.json", root)
    write(tmp_path / "task-a__1/agent/trajectory.cont-1.json", continuation)

    result = build(tmp_path)

    assert result is not None
    assert result.source_paths == (
        "agent/trajectory.json",
        "agent/trajectory.cont-1.json",
    )
    assert len([span for span in result.spans if span["span_kind"] == "AGENT"]) == 2


def test_embedded_subagent_remains_linked_after_id_rewrite(tmp_path: Path) -> None:
    parent = trajectory()
    child = trajectory(session_id="embedded-session")
    child["trajectory_id"] = "embedded-original"
    parent["subagent_trajectories"] = [child]
    parent["steps"][1]["tool_calls"] = [
        {"tool_call_id": "call-1", "function_name": "delegate", "arguments": {}}
    ]
    parent["steps"][1]["observation"] = {
        "results": [
            {
                "source_call_id": "call-1",
                "subagent_trajectory_ref": [
                    {"trajectory_id": "embedded-original", "session_id": "embedded-session"}
                ],
            }
        ]
    }
    write(tmp_path / "task-a__1/agent/trajectory.json", parent)

    result = build(tmp_path)

    assert result is not None
    agent_roots = [span for span in result.spans if span["span_kind"] == "AGENT"]
    assert len(agent_roots) == 2
    trial_root_id = result.spans[0]["context"]["span_id"]
    assert {span.get("parent_id") for span in agent_roots} != {trial_root_id}


def test_external_subagent_is_followed_and_rewritten(tmp_path: Path) -> None:
    parent = trajectory()
    parent["steps"][1]["tool_calls"] = [
        {"tool_call_id": "call-1", "function_name": "delegate", "arguments": {}}
    ]
    parent["steps"][1]["observation"] = {
        "results": [
            {
                "source_call_id": "call-1",
                "content": "delegated",
                "subagent_trajectory_ref": [
                    {
                        "trajectory_id": "child-original",
                        "session_id": "child-session",
                        "trajectory_path": "child.json",
                    }
                ],
            }
        ]
    }
    child = trajectory(session_id="child-session")
    child["trajectory_id"] = "child-original"
    write(tmp_path / "task-a__1/agent/trajectory.json", parent)
    write(tmp_path / "task-a__1/agent/child.json", child)

    result = build(tmp_path)

    assert result is not None
    assert result.source_paths == ("agent/trajectory.json", "agent/child.json")
    agent_roots = [span for span in result.spans if span["span_kind"] == "AGENT"]
    assert len(agent_roots) == 2
    trial_root_id = result.spans[0]["context"]["span_id"]
    assert {span.get("parent_id") for span in agent_roots} != {trial_root_id}
    assert all(
        str(span["attributes"].get("session.id", "")).startswith(f"harbor:{result.trace_id}:")
        for span in agent_roots
    )


def test_escaping_reference_is_not_read(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    parent = trajectory()
    parent["steps"][1]["observation"] = {
        "results": [
            {
                "subagent_trajectory_ref": [
                    {"trajectory_id": "secret", "trajectory_path": "../secret.json"}
                ]
            }
        ]
    }
    write(tmp_path / "task-a__1/agent/trajectory.json", parent)
    write(tmp_path / "task-a__1/secret.json", trajectory(session_id="do-not-read"))

    result = build(tmp_path)

    assert result is not None
    assert result.source_paths == ("agent/trajectory.json",)
    assert "Rejected Harbor ATIF reference" in caplog.text
    metadata = cast(dict[str, Any], result.spans[0]["attributes"]["metadata"])
    assert metadata["atif_unresolved_references"] == ["../secret.json"]


def test_invalid_or_missing_root_returns_no_trace(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    assert build(tmp_path) is None
    write(tmp_path / "task-a__1/agent/trajectory.json", {"not": "atif"})
    assert build(tmp_path) is None
    assert "no canonical root" in caplog.text
    assert "invalid Harbor ATIF root" in caplog.text


def test_different_trials_namespace_reused_producer_ids(tmp_path: Path) -> None:
    source = trajectory()
    write(tmp_path / "task-a__1/agent/trajectory.json", source)
    first = build(tmp_path)
    plan, slot, task, result = context(tmp_path)
    cast(Any, result).id = "other-trial-id"
    second = build_harbor_trace(
        plan=plan,
        slot=slot,
        task=task,
        trial_result=result,
        run_output={"harbor_trial_id": "other-trial-id"},
    )

    assert first is not None and second is not None
    assert first.trace_id != second.trace_id
    assert {span["context"]["span_id"] for span in first.spans}.isdisjoint(
        span["context"]["span_id"] for span in second.spans
    )
