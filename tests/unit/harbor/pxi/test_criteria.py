from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from evals.harbor.pxi import criteria
from evals.harbor.pxi.evaluators import EVALUATORS_BY_NAME

TESTS_DIR = Path(__file__).resolve().parents[4] / "evals" / "harbor" / "pxi" / "tests"

EXAMPLE: dict[str, Any] = {
    "dataset": "set_spans_filter",
    "id": "llm-spans",
    "splits": ["regression"],
    "evaluators": ["correct_tools_called", "tool_call_count_within_limit"],
    "input": {"messages": [{"role": "user", "content": "Show me only LLM spans."}]},
    "expected": {
        "tool_calls": [{"tool_name": "ui.spansFilter.set", "args": {"condition": "kind"}}],
        "max_tool_calls": 1,
    },
    "metadata": {},
}

TRANSCRIPT = [
    {
        "id": "seeded",
        "role": "user",
        "parts": [{"type": "text", "text": "Show me only LLM spans."}],
    },
    {
        "id": "reply",
        "role": "assistant",
        "parts": [
            {
                "type": "tool-ui.spansFilter.set",
                "toolCallId": "call-1",
                "input": {"condition": "span_kind == 'LLM'"},
            }
        ],
    },
]


@pytest.fixture
def trajectory(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    path = tmp_path / "trajectory.json"
    path.write_text(
        json.dumps(
            {
                "session_id": "session-1",
                "steps": [],
                "extra": {
                    "pxi": {
                        "example": EXAMPLE,
                        "scoring": {"seeded_message_ids": ["seeded"]},
                    }
                },
            }
        )
    )
    monkeypatch.setattr(criteria, "TRAJECTORY_PATH", path)
    monkeypatch.setattr(
        criteria, "fetch_session_messages", lambda base_url, session_id: list(TRANSCRIPT)
    )
    criteria._turn_results.cache_clear()
    return path


def test_every_evaluator_has_a_criteria_file() -> None:
    names = {path.parent.name for path in TESTS_DIR.glob("*/check.py")}
    assert names == set(EVALUATORS_BY_NAME)
    assert (TESTS_DIR / "test.sh").exists()
    assert (TESTS_DIR / "reward.toml").exists()


def test_declared_evaluators_come_from_the_seed(trajectory: Path) -> None:
    assert criteria.declared_evaluators() == EXAMPLE["evaluators"]


def test_missing_trajectory_is_a_clear_error(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="trajectory"):
        criteria.read_seed(tmp_path / "absent.json")


def test_evaluator_score_scores_the_turn_once(
    trajectory: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []

    def fetch(base_url: str, session_id: str) -> list[dict[str, Any]]:
        calls.append(session_id)
        return list(TRANSCRIPT)

    monkeypatch.setattr(criteria, "fetch_session_messages", fetch)
    assert criteria.evaluator_score("correct_tools_called") == 1.0
    assert criteria.evaluator_score("tool_call_count_within_limit") == 1.0
    assert calls == ["session-1"]
    with pytest.raises(KeyError):
        criteria.evaluator_score("in_app_links_valid")


def test_declare_rejects_unknown_evaluators(trajectory: Path) -> None:
    with pytest.raises(ValueError, match="unknown evaluator"):
        criteria.declare("not_an_evaluator")


def test_rewardkit_scores_only_the_declared_evaluators(trajectory: Path, tmp_path: Path) -> None:
    rewardkit = pytest.importorskip("rewardkit")
    output = tmp_path / "reward.json"
    scores = rewardkit.run(TESTS_DIR, workspace=tmp_path, output=output)
    assert scores == {
        "correct_tools_called": 1.0,
        "tool_call_count_within_limit": 1.0,
        "reward": 1.0,
    }
    assert json.loads(output.read_text()) == scores
