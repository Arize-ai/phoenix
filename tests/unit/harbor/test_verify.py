"""The shared verifier reads the reply and the measurements from an ATIF trajectory."""

import json
from pathlib import Path

from evals.harbor.verifiers import verify

TRAJECTORY = {
    "schema_version": "ATIF-v1.7",
    "steps": [
        {"source": "user", "message": "question"},
        {
            "source": "agent",
            "llm_call_count": 1,
            "tool_calls": [{"tool_call_id": "a"}, {"tool_call_id": "b"}],
        },
        {"source": "agent", "llm_call_count": 0, "tool_calls": [{"tool_call_id": "c"}]},
        {
            "source": "agent",
            "llm_call_count": 1,
            "is_copied_context": True,
            "tool_calls": [{"tool_call_id": "z"}],
            "message": "stale",
        },
        {"source": "system", "message": "compaction"},
        {"source": "agent", "llm_call_count": 1, "message": "There are **117** traces."},
    ],
}


def test_measurements_count_agent_steps_only() -> None:
    assert verify.measurements(TRAJECTORY) == {"tool_call_count": 3.0, "agent_turn_count": 3.0}
    assert verify.measurements(None) == {}


def test_final_reply_is_the_last_agent_message() -> None:
    assert verify.final_reply(TRAJECTORY) == "There are **117** traces."
    parts = {"steps": [{"source": "agent", "message": [{"type": "text", "text": "ok"}]}]}
    assert verify.final_reply(parts) == "ok"
    assert verify.final_reply({"steps": [{"source": "agent", "message": "  "}]}) == ""


def test_reply_comes_from_the_trajectory_then_the_answer_file(tmp_path: Path) -> None:
    trajectory = tmp_path / "trajectory.json"
    answer = tmp_path / "answer.txt"
    answer.write_text("oracle\n")
    assert verify.read_reply(trajectory, answer) == ("oracle\n", "answer_file")
    trajectory.write_text(json.dumps(TRAJECTORY))
    assert verify.read_reply(trajectory, answer) == ("There are **117** traces.", "trajectory")
    assert verify.read_reply(tmp_path / "none", tmp_path / "none") == ("", "answer_file")


def test_exact_check_ignores_emphasis_case_and_end_punctuation() -> None:
    expected = {"exact": "ok"}
    assert verify.check("**OK**.", expected) == (1.0, "exact match against 'ok'")
    assert verify.check("ok", expected)[0] == 1.0
    assert verify.check("okay", expected)[0] == 0.0
    assert verify.check("", expected)[0] == 0.0


def test_write_reward_attaches_measurements(tmp_path: Path) -> None:
    trajectory = tmp_path / "trajectory.json"
    trajectory.write_text(json.dumps(TRAJECTORY))
    reward_path = tmp_path / "reward.json"
    scores = verify.write_reward(
        1.0, trajectory_path=trajectory, reward_path=reward_path, extra=0.5
    )
    assert scores == {
        "reward": 1.0,
        "tool_call_count": 3.0,
        "agent_turn_count": 3.0,
        "extra": 0.5,
    }
    assert json.loads(reward_path.read_text()) == scores
