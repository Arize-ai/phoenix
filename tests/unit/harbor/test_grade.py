import json
from pathlib import Path

import pytest

from evals.harbor.lib import grade


def test_grade_answer_dispatches_on_kind() -> None:
    assert grade.grade_answer("117", {"kind": "integer", "value": 117})
    assert grade.grade_answer("61.3%", {"kind": "number", "value": [61.2, 61.3], "places": 1})
    assert grade.grade_answer("PageDownTool", {"kind": "name", "aliases": [["PageDownTool"]]})
    assert grade.grade_answer("ok", {"kind": "exact", "value": "ok"})
    assert not grade.grade_answer("", {"kind": "integer", "value": 117})
    with pytest.raises(ValueError, match="Unknown expected kind"):
        grade.grade_answer("x", {"kind": "regex", "value": "x"})


def test_grade_answer_supports_required_lists_and_composites() -> None:
    both = {"kind": "number", "value": [4.4, 9.8], "places": 1, "require_all": True}
    assert grade.grade_answer("Short: 4.4%; Long: 9.8%", both)
    assert not grade.grade_answer("Short: 4.4%", both)
    explanation = {
        "kind": "name",
        "aliases": [["forward"], ["unexpected", "unsupported"]],
        "require_all": True,
        "allow_hedging": True,
    }
    assert grade.grade_answer("forward() gets an unexpected keyword, either x or y", explanation)
    composite = {
        "kind": "all",
        "checks": [{"kind": "name", "aliases": [["SearchTool"]]}, {"kind": "integer", "value": 12}],
    }
    assert grade.grade_answer("SearchTool: 12 calls", composite)
    assert not grade.grade_answer("SearchTool: 11 calls", composite)
    assert not grade.grade_answer("117", {"kind": "integer", "value": None})


def test_main_grades_the_trajectory_reply_with_measurements(tmp_path: Path) -> None:
    answer = tmp_path / "answer.txt"
    answer.write_text("118\n")  # a stale file must not win over the agent's reply
    expected = tmp_path / "expected.json"
    expected.write_text(json.dumps({"kind": "integer", "value": 117}))
    trajectory = tmp_path / "trajectory.json"
    trajectory.write_text(
        json.dumps(
            {
                "steps": [
                    {"source": "user", "message": "How many traces?"},
                    {
                        "source": "agent",
                        "llm_call_count": 1,
                        "tool_calls": [{}],
                        "message": "Checking.",
                    },
                    {"source": "agent", "llm_call_count": 1, "message": "There are 117 traces."},
                ]
            }
        )
    )
    reward = tmp_path / "verifier" / "reward.json"
    grade.main(
        [
            "--expected",
            str(expected),
            "--answer",
            str(answer),
            "--trajectory",
            str(trajectory),
            "--reward-file",
            str(reward),
        ]
    )
    assert json.loads(reward.read_text()) == {
        "reward": 1.0,
        "tool_call_count": 1.0,
        "agent_turn_count": 2.0,
    }


def test_main_reads_the_answer_file_only_without_a_trajectory(tmp_path: Path) -> None:
    """The oracle runs a solution script, which has no trajectory and writes a file."""
    answer = tmp_path / "answer.txt"
    answer.write_text("117\n")
    expected = tmp_path / "expected.json"
    expected.write_text(json.dumps({"kind": "integer", "value": 117}))
    reward = tmp_path / "reward.json"
    args = ["--expected", str(expected), "--answer", str(answer), "--reward-file", str(reward)]
    grade.main([*args, "--trajectory", str(tmp_path / "none.json")])
    assert json.loads(reward.read_text()) == {"reward": 1.0}
    trajectory = tmp_path / "trajectory.json"
    trajectory.write_text(json.dumps({"steps": [{"source": "agent", "message": ""}]}))
    grade.main([*args, "--trajectory", str(trajectory)])
    assert json.loads(reward.read_text()) == {
        "reward": 0.0,
        "tool_call_count": 0.0,
        "agent_turn_count": 1.0,
    }


def test_missing_answer_and_trajectory_scores_zero_without_measurements(tmp_path: Path) -> None:
    expected = tmp_path / "expected.json"
    expected.write_text(json.dumps({"kind": "exact", "value": "ok"}))
    reward = tmp_path / "reward.json"
    scores = grade.write_reward(0.0, trajectory_path=tmp_path / "none.json", reward_path=reward)
    assert scores == {"reward": 0.0}
    grade.main(
        [
            "--expected",
            str(expected),
            "--answer",
            str(tmp_path / "none.txt"),
            "--trajectory",
            str(tmp_path / "none.json"),
            "--reward-file",
            str(reward),
        ]
    )
    assert json.loads(reward.read_text()) == {"reward": 0.0}
