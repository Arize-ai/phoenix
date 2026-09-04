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
    StepRecord,
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
    legacy_config: bool = False,
    started_at: datetime | None | str = "default",
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
    config: Any = trial_config
    if simulated_user:
        config = SimpleNamespace(
            trials_dir=trial_config.trials_dir,
            agent=trial_config.agent,
            user_agent=object(),
        )
    elif legacy_config:
        config = SimpleNamespace(trials_dir=trial_config.trials_dir, agent=trial_config.agent)
    result = cast(
        TrialResult,
        SimpleNamespace(
            id="trial-id",
            config=config,
            trial_name="task-a__1",
            task_name="task-a",
            started_at=now if started_at == "default" else started_at,
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
    return build_from(plan, slot, task, result)


def build_from(plan: JobPlan, slot: TrialSlot, task: TaskRecord, result: TrialResult) -> Any:
    return build_harbor_trace(
        plan=plan,
        slot=slot,
        task=task,
        trial_result=result,
        run_output={"harbor_trial_id": str(result.id)},
    )


def build_with_request_times(tmp_path: Path, request_times: list[float], **kwargs: Any) -> Any:
    plan, slot, task, result = context(tmp_path, **kwargs)
    cast(Any, result).agent_result = SimpleNamespace(
        metadata={"api_request_times_msec": request_times}
    )
    return build_from(plan, slot, task, result)


def llm_metadata(trace: Any, key: str) -> list[Any]:
    return [
        span.get("attributes", {}).get("metadata", {}).get(key)
        for span in trace.spans
        if span["span_kind"] == "LLM"
    ]


def agent_roots(trace: Any) -> list[Any]:
    return [span for span in trace.spans if span["span_kind"] == "AGENT"]


def test_single_step_builds_one_stable_chain_root(tmp_path: Path) -> None:
    source = trajectory()
    write(tmp_path / "task-a__1/agent/trajectory.json", source)
    write(tmp_path / "task-a__1/agent/trajectory.stale.json", trajectory(session_id="stale"))

    first = build(tmp_path)
    second = build(tmp_path)

    assert first is not None and second is not None
    assert first == second
    assert first.source_paths == ("agent/trajectory.json",)
    assert first.spans[0]["name"] == "harbor.trial task-a"
    assert first.spans[0]["span_kind"] == "CHAIN"
    assert first.spans[0]["status_code"] == "OK"
    assert all(span["context"]["trace_id"] == first.trace_id for span in first.spans)
    assert all(
        span.get("parent_id") in {item["context"]["span_id"] for item in first.spans}
        for span in first.spans[1:]
    )
    assert json.loads((tmp_path / "task-a__1/agent/trajectory.json").read_text()) == source


def test_missing_atif_timestamps_use_stable_harbor_completion_time(tmp_path: Path) -> None:
    source = trajectory()
    for step in source["steps"]:
        step.pop("timestamp")
    write(tmp_path / "task-a__1/agent/trajectory.json", source)

    first = build(tmp_path)
    second = build(tmp_path)

    assert first is not None and second is not None
    assert first == second
    llm_span = next(span for span in first.spans if span["span_kind"] == "LLM")
    assert llm_span["start_time"] == NOW
    assert llm_span["end_time"] == NOW


def test_harbor_request_measurements_time_matching_llm_steps(tmp_path: Path) -> None:
    source = trajectory()
    source["steps"][1]["timestamp"] = "2026-08-26T12:00:05+00:00"
    write(tmp_path / "task-a__1/agent/trajectory.json", source)

    trace = build_with_request_times(tmp_path, [2500.0])

    assert trace is not None
    llm_span = next(span for span in trace.spans if span["span_kind"] == "LLM")
    assert llm_span["start_time"] == NOW
    assert llm_span["end_time"] == "2026-08-26T12:00:02.500000+00:00"
    assert llm_metadata(trace, "atif.timing") == ["harbor.api_request_times_msec"]
    assert llm_metadata(trace, "atif.measured_latency_ms") == [2500.0]


def test_every_span_shares_one_trial_session(tmp_path: Path) -> None:
    write(tmp_path / "task-a__1/agent/trajectory.json", trajectory())

    result = build(tmp_path)

    assert result is not None
    session = f"harbor:{result.trace_id}"
    assert all(span["attributes"].get("session.id") == session for span in result.spans)
    metadata = cast(dict[str, Any], agent_roots(result)[0]["attributes"]["metadata"])
    assert metadata["phoenix.harbor.producer_session_id"] == "producer-session"
    assert metadata["phoenix.harbor.producer_trajectory_id"] == "producer-trajectory"


def test_legacy_trial_config_without_user_agent_field(tmp_path: Path) -> None:
    write(tmp_path / "task-a__1/agent/trajectory.json", trajectory())

    result = build(tmp_path, legacy_config=True)

    assert result is not None
    assert result.source_paths == ("agent/trajectory.json",)


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
    trial_root_id = result.spans[0]["context"]["span_id"]
    steps = [span for span in result.spans if span["name"].startswith("harbor.step ")]
    assert [span["name"] for span in steps] == ["harbor.step 1 prepare", "harbor.step 2 solve"]
    assert all(span["span_kind"] == "CHAIN" for span in steps)
    assert [span["parent_id"] for span in steps] == [trial_root_id] * 2
    assert [span["parent_id"] for span in agent_roots(result)] == [
        span["context"]["span_id"] for span in steps
    ]
    assert [span["name"] for span in agent_roots(result)] == ["invoke_agent terminus-2"] * 2
    assert all(
        span["attributes"]["metadata"]["harbor.step_name"] == "solve"
        for span in result.spans
        if span.get("parent_id") == steps[1]["context"]["span_id"]
    )


def test_step_span_records_instruction_reward_timing_and_status(tmp_path: Path) -> None:
    write(tmp_path / "task-a__1/steps/solve/agent/trajectory.json", trajectory())
    plan, slot, task, result = context(tmp_path, step_names=("solve",))
    task = TaskRecord(
        lock=task.lock,
        name=task.name,
        instruction=task.instruction,
        steps=(StepRecord(name="solve", instruction="Solve it"),),
    )
    started = datetime.fromisoformat("2026-08-26T11:59:00+00:00")
    finished = datetime.fromisoformat("2026-08-26T12:00:30+00:00")
    cast(Any, result).step_results = [
        SimpleNamespace(
            step_name="solve",
            exception_info=SimpleNamespace(exception_type="RuntimeError", exception_message="boom"),
            verifier_result=SimpleNamespace(rewards={"reward": 0.5}),
            agent_execution=SimpleNamespace(started_at=started, finished_at=None),
            verifier=SimpleNamespace(started_at=None, finished_at=finished),
        )
    ]

    trace = build_from(plan, slot, task, result)

    assert trace is not None
    step = next(span for span in trace.spans if span["name"] == "harbor.step 1 solve")
    assert step["attributes"]["input.value"] == "Solve it"
    assert json.loads(str(step["attributes"]["output.value"])) == {"reward": 0.5}
    assert step["attributes"]["metadata"] == {"harbor.step_index": 1, "harbor.step_name": "solve"}
    assert (step["start_time"], step["end_time"]) == (started.isoformat(), finished.isoformat())
    assert (step["status_code"], step.get("status_message")) == (
        "ERROR",
        "solve: RuntimeError: boom",
    )
    assert trace.spans[0]["status_code"] == "ERROR"


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
    from harbor.models.trial.paths import TrialPaths

    if not hasattr(TrialPaths, "user_agent_dir"):
        pytest.skip("Simulated-user trials require Harbor >=0.22")
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
    assert len(agent_roots(result)) == 2


def test_agent_request_measurements_do_not_leak_to_simulated_user(tmp_path: Path) -> None:
    from harbor.models.trial.paths import TrialPaths

    if not hasattr(TrialPaths, "user_agent_dir"):
        pytest.skip("Simulated-user trials require Harbor >=0.22")
    write(tmp_path / "task-a__1/agent/trajectory.json", trajectory())
    user_trajectory = trajectory(session_id="user-agent-session")
    user_trajectory["agent"]["name"] = "user-simulator"
    write(tmp_path / "task-a__1/user-agent/trajectory.json", user_trajectory)

    trace = build_with_request_times(tmp_path, [100.0], simulated_user=True)

    assert trace is not None
    assert sorted(llm_metadata(trace, "atif.measured_latency_ms"), key=str) == [100.0, None]


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
    assert len(agent_roots(result)) == 2
    assert [
        root["attributes"]["metadata"].get("is_continuation") for root in agent_roots(result)
    ] == [None, True]
    assert [span["name"] for span in agent_roots(result)] == [
        "invoke_agent terminus-2",
        "invoke_agent terminus-2 (continuation 1)",
    ]


def test_request_measurements_cover_continuation_documents(tmp_path: Path) -> None:
    root = trajectory()
    root["steps"][1]["timestamp"] = "2026-08-26T12:00:01+00:00"
    root["continued_trajectory_ref"] = "trajectory.cont-1.json"
    continuation = trajectory(session_id="producer-session-cont-1")
    continuation["steps"][0]["timestamp"] = "2026-08-26T12:00:02+00:00"
    continuation["steps"][1]["timestamp"] = "2026-08-26T12:00:03+00:00"
    write(tmp_path / "task-a__1/agent/trajectory.json", root)
    write(tmp_path / "task-a__1/agent/trajectory.cont-1.json", continuation)

    trace = build_with_request_times(tmp_path, [100.0, 200.0])

    assert trace is not None
    assert llm_metadata(trace, "atif.measured_latency_ms") == [100.0, 200.0]


def test_cross_document_request_measurements_require_complete_clocks(tmp_path: Path) -> None:
    root = trajectory()
    root["continued_trajectory_ref"] = "trajectory.cont-1.json"
    continuation = trajectory(session_id="producer-session-cont-1")
    continuation["steps"][1].pop("timestamp")
    write(tmp_path / "task-a__1/agent/trajectory.json", root)
    write(tmp_path / "task-a__1/agent/trajectory.cont-1.json", continuation)

    trace = build_with_request_times(tmp_path, [100.0, 200.0])

    assert trace is not None
    assert llm_metadata(trace, "atif.timing") == ["event", "event"]


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
    roots = agent_roots(result)
    assert len(roots) == 2
    trial_root_id = result.spans[0]["context"]["span_id"]
    tool_ids = {span["context"]["span_id"] for span in result.spans if span["span_kind"] == "TOOL"}
    assert {span["parent_id"] for span in roots} == {trial_root_id, *tool_ids}


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
    roots = agent_roots(result)
    assert len(roots) == 2
    trial_root_id = result.spans[0]["context"]["span_id"]
    tool_ids = {span["context"]["span_id"] for span in result.spans if span["span_kind"] == "TOOL"}
    assert {span["parent_id"] for span in roots} == {trial_root_id, *tool_ids}
    session = f"harbor:{result.trace_id}"
    assert all(span["attributes"].get("session.id") == session for span in roots)


def test_pre_v17_session_keyed_ref_links_child_without_cycles(tmp_path: Path) -> None:
    """A v1.6 ref keyed by session_id resolves to the loaded child, not to the trial session."""
    parent = trajectory()
    parent["schema_version"] = "ATIF-v1.6"
    del parent["trajectory_id"]
    parent["steps"][1]["tool_calls"] = [
        {"tool_call_id": "call-1", "function_name": "delegate", "arguments": {}}
    ]
    parent["steps"][1]["observation"] = {
        "results": [
            {
                "source_call_id": "call-1",
                "subagent_trajectory_ref": [
                    {"session_id": "child-session", "trajectory_path": "child.json"}
                ],
            }
        ]
    }
    child = trajectory(session_id="child-session")
    child["schema_version"] = "ATIF-v1.6"
    del child["trajectory_id"]
    child["agent"]["name"] = "delegate"
    write(tmp_path / "task-a__1/agent/trajectory.json", parent)
    write(tmp_path / "task-a__1/agent/child.json", child)

    result = build(tmp_path)

    assert result is not None
    assert result.source_paths == ("agent/trajectory.json", "agent/child.json")
    span_ids = {span["context"]["span_id"] for span in result.spans}
    assert all(span.get("parent_id") in span_ids for span in result.spans[1:])
    parent_root = next(
        span for span in agent_roots(result) if span["name"] == "invoke_agent terminus-2"
    )
    child_root = next(
        span for span in agent_roots(result) if span["name"] == "invoke_agent delegate"
    )
    tool = next(span for span in result.spans if span["span_kind"] == "TOOL")
    assert parent_root["parent_id"] == result.spans[0]["context"]["span_id"]
    assert child_root["parent_id"] == tool["context"]["span_id"]
    assert tool["parent_id"] != child_root["context"]["span_id"]


def test_pre_v17_unresolved_ref_does_not_capture_a_continuation(tmp_path: Path) -> None:
    parent = trajectory()
    parent["schema_version"] = "ATIF-v1.6"
    parent["continued_trajectory_ref"] = "trajectory.cont-1.json"
    parent["steps"][1]["observation"] = {
        "results": [
            {
                "subagent_trajectory_ref": [
                    {
                        "trajectory_id": "missing-child",
                        "session_id": "missing-session",
                        "trajectory_path": "../missing.json",
                    }
                ]
            }
        ]
    }
    continuation = trajectory(session_id="producer-session-cont-1")
    continuation["schema_version"] = "ATIF-v1.6"
    continuation["trajectory_id"] = "continuation"
    write(tmp_path / "task-a__1/agent/trajectory.json", parent)
    write(tmp_path / "task-a__1/agent/trajectory.cont-1.json", continuation)

    result = build(tmp_path)

    assert result is not None
    roots = agent_roots(result)
    trial_root_id = result.spans[0]["context"]["span_id"]
    assert len(roots) == 2
    assert {root["parent_id"] for root in roots} == {trial_root_id}


def test_system_handoff_without_tool_stays_at_its_causal_step(tmp_path: Path) -> None:
    parent = trajectory()
    parent["steps"] = [
        parent["steps"][0],
        {
            "step_id": 2,
            "timestamp": NOW,
            "source": "system",
            "message": "Performed context summarization",
            "observation": {
                "results": [{"subagent_trajectory_ref": [{"trajectory_path": "summary.json"}]}]
            },
        },
        {**parent["steps"][1], "step_id": 3},
    ]
    child = trajectory(session_id="summary-session")
    child["trajectory_id"] = "summary-document"
    child["agent"]["name"] = "summarizer"
    write(tmp_path / "task-a__1/agent/trajectory.json", parent)
    write(tmp_path / "task-a__1/agent/summary.json", child)

    result = build(tmp_path)

    assert result is not None
    system_step = next(span for span in result.spans if span["name"] == "system event 1")
    child_root = next(
        span for span in agent_roots(result) if span["name"] == "invoke_agent summarizer"
    )
    assert child_root["parent_id"] == system_step["context"]["span_id"]


def test_shared_child_file_is_loaded_once(tmp_path: Path) -> None:
    parent = trajectory()
    parent["steps"][1]["tool_calls"] = [
        {"tool_call_id": "call-1", "function_name": "delegate", "arguments": {}},
        {"tool_call_id": "call-2", "function_name": "delegate", "arguments": {}},
    ]
    parent["steps"][1]["observation"] = {
        "results": [
            {
                "source_call_id": call_id,
                "subagent_trajectory_ref": [{"trajectory_path": "child.json"}],
            }
            for call_id in ("call-1", "call-2")
        ]
    }
    write(tmp_path / "task-a__1/agent/trajectory.json", parent)
    write(tmp_path / "task-a__1/agent/child.json", trajectory(session_id="child-session"))

    result = build(tmp_path)

    assert result is not None
    assert result.source_paths == ("agent/trajectory.json", "agent/child.json")
    assert len(agent_roots(result)) == 2
    child_root = next(
        span
        for span in agent_roots(result)
        if (span.get("attributes", {}).get("metadata", {}) or {}).get(
            "phoenix.harbor.producer_session_id"
        )
        == "child-session"
    )
    first_tool = next(
        span
        for span in result.spans
        if span["span_kind"] == "TOOL"
        and (span.get("attributes", {}).get("metadata", {}) or {}).get("atif.tool_call_index") == 0
    )
    assert child_root["parent_id"] == first_tool["context"]["span_id"]


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
    assert "Rejected Harbor ATIF path" in caplog.text
    metadata = cast(dict[str, Any], result.spans[0]["attributes"]["metadata"])
    assert metadata["atif_unresolved_references"] == ["../secret.json"]


def test_remote_reference_is_reported_without_its_path(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    parent = trajectory()
    parent["steps"][1]["observation"] = {
        "results": [
            {
                "subagent_trajectory_ref": [
                    {"trajectory_path": "s3://bucket/private/child.json?token=x"}
                ]
            }
        ]
    }
    write(tmp_path / "task-a__1/agent/trajectory.json", parent)

    result = build(tmp_path)

    assert result is not None
    assert "Rejected non-local Harbor ATIF reference 's3://bucket'" in caplog.text
    metadata = cast(dict[str, Any], result.spans[0]["attributes"]["metadata"])
    assert metadata["atif_unresolved_references"] == ["s3://bucket"]


def test_cyclic_continuation_stops(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    first = trajectory()
    first["continued_trajectory_ref"] = "trajectory.cont-1.json"
    second = trajectory(session_id="producer-session-cont-1")
    second["continued_trajectory_ref"] = "trajectory.json"
    write(tmp_path / "task-a__1/agent/trajectory.json", first)
    write(tmp_path / "task-a__1/agent/trajectory.cont-1.json", second)

    result = build(tmp_path)

    assert result is not None
    assert result.source_paths == ("agent/trajectory.json", "agent/trajectory.cont-1.json")
    assert "Stopped cyclic Harbor ATIF reference" in caplog.text


def test_invalid_or_missing_root_returns_no_trace(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    assert build(tmp_path) is None
    write(tmp_path / "task-a__1/agent/trajectory.json", {"not": "atif"})
    assert build(tmp_path) is None
    assert "no canonical root" in caplog.text
    assert "invalid Harbor ATIF root" in caplog.text


def test_missing_trial_timestamps_return_no_trace(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    write(tmp_path / "task-a__1/agent/trajectory.json", trajectory())

    assert build(tmp_path, started_at=None) is None
    assert "no complete start and end timestamps" in caplog.text


def test_scored_step_failure_marks_root_error(tmp_path: Path) -> None:
    write(tmp_path / "task-a__1/steps/solve/agent/trajectory.json", trajectory())
    plan, slot, task, result = context(tmp_path, step_names=("solve",))
    error = SimpleNamespace(exception_type="RuntimeError", exception_message="boom")
    cast(Any, result).step_results = [
        SimpleNamespace(
            step_name="solve",
            exception_info=error,
            verifier_result=SimpleNamespace(rewards={"reward": 0.0}),
        )
    ]

    trace = build_from(plan, slot, task, result)

    assert trace is not None
    assert trace.spans[0]["status_code"] == "ERROR"
    assert trace.spans[0].get("status_message") == "solve: RuntimeError: boom"


def test_different_trials_namespace_reused_producer_ids(tmp_path: Path) -> None:
    source = trajectory()
    write(tmp_path / "task-a__1/agent/trajectory.json", source)
    first = build(tmp_path)
    plan, slot, task, result = context(tmp_path)
    cast(Any, result).id = "other-trial-id"
    second = build_from(plan, slot, task, result)

    assert first is not None and second is not None
    assert first.trace_id != second.trace_id
    assert {span["context"]["span_id"] for span in first.spans}.isdisjoint(
        span["context"]["span_id"] for span in second.spans
    )
