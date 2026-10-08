import json
from pathlib import Path
from typing import Any

import pytest

from api_selection_verifiers import verify


def _call(name: str, **arguments: Any) -> dict[str, Any]:
    return {"tool_call_id": name, "function_name": name, "arguments": arguments}


def _trajectory(*calls: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema_version": "ATIF-v1.7",
        "steps": [
            {"source": "user", "message": "question", "timestamp": "2026-10-02T10:00:00Z"},
            {"source": "agent", "tool_calls": list(calls), "timestamp": "2026-10-02T10:00:05Z"},
            {"source": "agent", "message": "**42**", "timestamp": "2026-10-02T10:01:35Z"},
        ],
    }


def test_api_selection_is_correct_when_sql_is_used_exactly_on_sql_tasks() -> None:
    sql = {"used_sql": 1.0}
    rest = {"used_sql": 0.0}
    assert verify.api_selection_correct("sql", sql) == 1.0
    assert verify.api_selection_correct("sql", rest) == 0.0
    assert verify.api_selection_correct("http", rest) == 1.0
    assert verify.api_selection_correct("http", sql) == 0.0
    with pytest.raises(ValueError, match="expected_api"):
        verify.api_selection_correct("graphql", sql)
    with pytest.raises(ValueError, match="expected_api"):
        verify.api_selection_correct(None, sql)  # type: ignore[arg-type]


def test_main_writes_the_reward_with_the_surface_diagnostics(tmp_path: Path) -> None:
    expected = tmp_path / "expected.json"
    expected.write_text(json.dumps({"exact": "42", "expected_api": "http"}))
    trajectory = tmp_path / "trajectory.json"
    trajectory.write_text(
        json.dumps(_trajectory(_call("getProjects"), _call("executeSql", sql="select 1")))
    )
    reward_file = tmp_path / "reward.json"
    verify.main(
        [
            "--expected",
            str(expected),
            "--trajectory",
            str(trajectory),
            "--reward-file",
            str(reward_file),
        ]
    )
    scores = json.loads(reward_file.read_text())
    assert scores["reward"] == 1.0
    assert scores["api_selection_correct"] == 0.0
    assert scores["used_sql"] == 1.0 and scores["used_rest"] == 1.0
    assert scores["tool_count"] == 2.0


def test_oracle_runs_without_a_trajectory_count_as_the_http_choice(tmp_path: Path) -> None:
    expected = tmp_path / "expected.json"
    expected.write_text(json.dumps({"exact": "ok", "expected_api": "http"}))
    answer = tmp_path / "answer.txt"
    answer.write_text("ok\n")
    reward_file = tmp_path / "reward.json"
    verify.main(
        [
            "--expected",
            str(expected),
            "--answer",
            str(answer),
            "--trajectory",
            str(tmp_path / "missing.json"),
            "--reward-file",
            str(reward_file),
        ]
    )
    scores = json.loads(reward_file.read_text())
    assert scores["reward"] == 1.0
    assert scores["api_selection_correct"] == 1.0
    assert scores["sql_call_count"] == 0.0
