import json
import tomllib

import pytest

from measurements import final_answer, trajectory_measurements
from stage_task import TASKS, stage
from verify import grade, verify


@pytest.mark.parametrize(
    "answer",
    [
        "117",
        "The project contains 117 traces.",
        "There are **117** traces.",
        "Count: 117",
        "117.",
        "117 traces across 3,579 spans.",
    ],
)
def test_count_accepts_unambiguous_exact_final_answer(answer):
    assert grade("count-traces", answer, {"value": 117}) == {"reward": 1}


@pytest.mark.parametrize(
    "answer",
    [
        True,
        None,
        "",
        "1170 traces",
        "117 spans",
        "Not 117 traces.",
        "Maybe 117 traces",
        "117 traces or 118 traces",
        "The example says 117 traces.",
        "I cannot tell whether there are 117 traces.",
        "The log mentions 117 traces.",
        "There aren't 117 traces.",
        "There are at least 117 traces.",
        "The count is 118. I saw 117 in logs.",
    ],
)
def test_count_rejects_wrong_incidental_or_contradictory_numbers(answer):
    assert grade("count-traces", answer, {"value": 117})["reward"] == 0


def test_missing_truth_is_infrastructure_failure():
    with pytest.raises(ValueError, match="trusted"):
        grade("count-traces", "117", {})


def test_task_specific_checks_cover_both_requested_values():
    ref = {"short": 0.8, "long": 14.6}
    assert (
        grade("error-rate-by-length", "Short (<15 spans): 0.8%; long (40+): 14.6%", ref)["reward"]
        == 1
    )
    assert grade("error-rate-by-length", "Short: 5%; long: 14.6%", ref)["reward"] == 0
    assert grade("error-rate-by-length", "Long: 14.6%", ref)["reward"] == 0
    ref = {"winners": [["FinderTool", "finder"]], "value": 24}
    assert grade("repeated-tool-calls", "FinderTool: 24 calls", ref)["reward"] == 1
    assert grade("repeated-tool-calls", "FinderTool: 23 calls", ref)["reward"] == 0
    assert grade("repeated-tool-calls", "FinderTool", ref)["reward"] == 0


def test_cost_precision_ties_and_root_cause():
    assert grade("total-cost", "$16.0022", {"value": 16.00221})["reward"] == 1
    assert grade("total-cost", "16,002 tokens", {"value": 16.00221})["reward"] == 0
    assert grade("spend-concentration", "45.3%", {"value": 45.31})["reward"] == 1
    assert grade("spend-concentration", "43.1%", {"value": 45.31})["reward"] == 0
    ref = {"winners": [["PageDownTool", "page_down"], ["OtherTool"]]}
    assert grade("most-failing-tool", "page_down and OtherTool tied", ref)["reward"] == 1
    assert grade("most-failing-tool", "page_down", ref)["reward"] == 0
    ref = {"signatures": ["forward() got an unexpected keyword argument 'page'"]}
    assert (
        grade(
            "pagedown-root-cause",
            "The caller passes the unsupported keyword page to forward()",
            ref,
        )["reward"]
        == 1
    )
    assert (
        grade("pagedown-root-cause", "It gets a TypeError: unexpected keyword argument", ref)[
            "reward"
        ]
        == 0
    )
    assert grade("pagedown-root-cause", "The server timed out", ref)["reward"] == 0


def test_final_answer_and_call_count_exclude_intermediate_and_copied_context():
    call = {
        "tool_call_id": "call1",
        "function_name": "execute",
        "arguments": {"code": "many operations"},
    }
    steps = [
        {"source": "user", "message": "How many?"},
        {
            "source": "agent",
            "message": "117 traces",
            "tool_calls": [call],
            "observation": {"results": [{"source_call_id": "call1", "content": "failed"}]},
        },
        {"source": "agent", "is_copied_context": True, "tool_calls": [call]},
        {"source": "agent", "message": "118 traces", "tool_calls": []},
    ]
    trajectory = {"schema_version": "ATIF-v1.7", "steps": steps}
    assert final_answer(trajectory) == "118 traces"
    assert trajectory_measurements(trajectory) == {
        "tool_measurement_complete": 1,
        "tool_call_count": 1,
        "agent_turn_count": 2,
    }
    steps.pop()
    assert final_answer(trajectory) is None
    assert "tool_call_count" not in trajectory_measurements(None)
    assert (
        trajectory_measurements(
            {"schema_version": "ATIF-v1.7", "steps": [{"source": "agent", "message": "ok"}]}
        )["tool_call_count"]
        == 0
    )


def test_all_task_metadata_and_prompts_share_seed_identity(tmp_path):
    manifest = {
        "project": "a-custom-project",
        "corpus": "PatronusAI/TRAIL",
        "revision": "a" * 40,
        "fixture_hash": "b" * 64,
    }
    tasks = stage(manifest, tmp_path, image="sha256:" + "c" * 64)
    assert len(tasks) == 10
    for task in tasks:
        config = tomllib.loads((task / "task.toml").read_text())
        assert set(config["metadata"]) == {"task_class", "fixture"}
        assert config["metadata"]["fixture"]["fixture_hash"] == manifest["fixture_hash"]
        assert config["task"]["name"] == "arize/" + task.name
        text = (task / "instruction.md").read_text()
        assert "trail-gaia" not in text and "evidence_trace_ids" not in text
        assert "a-custom-project" in text or task.name == "noop-surface-cost"
    assert "count-traces" in TASKS and "trace-count" not in TASKS


def test_unavailable_measurements_do_not_change_valid_reward(tmp_path):
    (tmp_path / "submission.json").write_text(json.dumps({"task": "count-traces", "answer": "117"}))
    (tmp_path / "reference.json").write_text('{"value": 117}')
    (tmp_path / "measurements.json").write_text('{"tool_measurement_complete": 0}')
    assert verify(tmp_path) == {"reward": 1, "tool_measurement_complete": 0}


async def test_native_plugin_preserves_small_metadata_and_versions_seed_changes(tmp_path):
    from harbor.job import Job
    from harbor.models.job.config import DatasetConfig, JobConfig
    from harbor.models.trial.config import AgentConfig
    from phoenix.client.harbor._adapter import build_job_plan

    manifest = {
        "project": "research-assistant",
        "corpus": "test",
        "revision": "a" * 40,
        "fixture_hash": "b" * 64,
    }
    tasks = stage(manifest, tmp_path / "collection", image="sha256:" + "c" * 64)
    task = next(t for t in tasks if t.name == "count-traces")

    async def plan(name):
        job = await Job.create(
            JobConfig(
                job_name=name,
                jobs_dir=tmp_path / "jobs",
                datasets=[DatasetConfig(path=task.parent, task_names=["count-traces"])],
                agents=[AgentConfig(name="oracle")],
            )
        )
        return build_job_plan(job)

    first = await plan("first")
    meta = first.tasks[0].to_example()["metadata"]["task_config"]["metadata"]
    assert set(meta) == {"task_class", "fixture"}
    assert meta["fixture"]["fixture_hash"] == "b" * 64
    assert first.tasks[0].config["verifier"]["environment_mode"] == "separate"
    config = task / "task.toml"
    config.write_text(config.read_text().replace("b" * 64, "d" * 64))
    second = await plan("second")
    assert first.tasks[0].task_id == second.tasks[0].task_id
    assert first.tasks[0].digest != second.tasks[0].digest


def test_signed_cost_and_repetition_answers_do_not_match_positive_truth():
    assert grade("total-cost", "$-16.00", {"value": 16})["reward"] == 0
    assert grade("spend-concentration", "-45.3%", {"value": 45.3})["reward"] == 0
    assert (
        grade(
            "repeated-tool-calls",
            "FinderTool: -24 calls",
            {"value": 24, "winners": [["FinderTool"]]},
        )["reward"]
        == 0
    )
