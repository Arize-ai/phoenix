from pathlib import Path

from evals.harbor.lib import atif


def test_measurements_count_agent_steps_only() -> None:
    trajectory = {
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
            },
            {"source": "system", "message": "compaction"},
            {"source": "agent", "llm_call_count": 1, "message": "117"},
        ],
    }
    assert atif.measurements(trajectory) == {"tool_call_count": 3.0, "agent_turn_count": 2.0}


def test_missing_or_malformed_trajectory_yields_no_measurements(tmp_path: Path) -> None:
    assert atif.measurements(None) == {}
    assert atif.measurements({"steps": "not a list"}) == {}
    assert atif.read_trajectory(tmp_path / "absent.json") is None
    (tmp_path / "bad.json").write_text("[1, 2")
    assert atif.read_trajectory(tmp_path / "bad.json") is None
