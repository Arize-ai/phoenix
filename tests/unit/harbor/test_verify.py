import json
import os
from pathlib import Path

import pytest
from vcr.request import Request as VCRRequest  # type: ignore[import-untyped]

from harbor_verifiers import llm_judge, verify
from tests.unit.vcr import CustomVCR

MOST_FAILING_TOOL_EXPECTED = (
    Path(__file__).parents[3]
    / "evals/harbor/tasks/trail-benchmark-dev/most-failing-tool/tests/expected.json"
)

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
    assert verify.measurements(TRAJECTORY) == {"tool_count": 3.0, "turn_count": 3.0}
    assert verify.measurements(None) == {}


def test_get_final_reply_is_the_last_agent_message() -> None:
    assert verify.get_final_reply(TRAJECTORY) == "There are **117** traces."
    parts = {"steps": [{"source": "agent", "message": [{"type": "text", "text": "ok"}]}]}
    assert verify.get_final_reply(parts) == "ok"
    assert verify.get_final_reply({"steps": [{"source": "agent", "message": "  "}]}) == ""


def test_load_trajectory_is_none_when_missing_and_fails_when_malformed(tmp_path: Path) -> None:
    trajectory = tmp_path / "trajectory.json"
    assert verify.load_trajectory(trajectory) is None
    trajectory.write_text(json.dumps(TRAJECTORY))
    assert verify.load_trajectory(trajectory) == TRAJECTORY
    trajectory.write_text("[]")
    with pytest.raises(ValueError, match="ATIF"):
        verify.load_trajectory(trajectory)
    trajectory.write_text("{not json")
    with pytest.raises(ValueError):
        verify.load_trajectory(trajectory)


def test_exact_check_ignores_emphasis_case_and_end_punctuation() -> None:
    assert verify.check_exact("**OK**.", "ok") == 1.0
    assert verify.check_exact("ok", "ok") == 1.0
    assert verify.check_exact("okay", "ok") == 0.0
    assert verify.check_exact("", "ok") == 0.0


def test_reference_check_grades_semantic_answers(
    custom_vcr: CustomVCR,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", os.environ.get("OPENAI_API_KEY") or "sk-test")
    # The cassette was recorded against gpt-5-nano; the default judge has since moved on.
    monkeypatch.setattr(llm_judge, "JUDGE_MODEL", "gpt-5-nano")
    expected = json.loads(MOST_FAILING_TOOL_EXPECTED.read_text())
    cases = [
        ("**page_down (PageDownTool)** — 109 failed spans...", 1.0),
        (
            "The page_down tool failed the most: **109 times** out of 174 failed tool spans.",
            1.0,
        ),
        ("TextInspectorTool", 0.0),
        ("Either page_down or TextInspectorTool; I cannot determine which.", 0.0),
        ("PageDownTool appeared frequently, but TextInspectorTool failed the most.", 0.0),
        ("TextInspectorTool, not page_down, had the most failures.", 0.0),
    ]

    custom_vcr.register_matcher(_json_bodies_match.__name__, _json_bodies_match)
    with custom_vcr.use_cassette(
        match_on=["method", "scheme", "host", "port", "path", "query", _json_bodies_match.__name__]
    ):
        scores = [
            verify.check_reference(reply, expected["reference"], notes=expected["notes"])[0]
            for reply, _ in cases
        ]

    assert scores == [score for _, score in cases]


def test_main_grades_the_answer_file_when_there_is_no_trajectory(tmp_path: Path) -> None:
    expected = tmp_path / "expected.json"
    expected.write_text(json.dumps({"exact": "ok"}))
    answer = tmp_path / "answer.txt"
    answer.write_text("OK\n")
    reward_file = tmp_path / "reward.json"
    args = ["--expected", str(expected), "--answer", str(answer), "--reward-file", str(reward_file)]
    verify.main([*args, "--trajectory", str(tmp_path / "missing.json")])
    assert json.loads(reward_file.read_text()) == {"reward": 1.0}
    with pytest.raises(FileNotFoundError):
        verify.main(
            [
                "--expected",
                str(expected),
                "--answer",
                str(tmp_path / "none"),
                "--reward-file",
                str(reward_file),
                "--trajectory",
                str(tmp_path / "none"),
            ]
        )


def test_write_reward_attaches_measurements(tmp_path: Path) -> None:
    trajectory = tmp_path / "trajectory.json"
    trajectory.write_text(json.dumps(TRAJECTORY))
    reward_path = tmp_path / "reward.json"
    scores = verify.write_reward(
        1.0, trajectory_path=trajectory, reward_path=reward_path, extra=0.5
    )
    assert scores == {
        "reward": 1.0,
        "tool_count": 3.0,
        "turn_count": 3.0,
        "extra": 0.5,
    }
    assert json.loads(reward_path.read_text()) == scores
    assert not (tmp_path / "details.json").exists()


def test_write_reward_keeps_non_numeric_components_out_of_the_reward(tmp_path: Path) -> None:
    reward_path = tmp_path / "reward.json"
    scores = verify.write_reward(
        0.0,
        {"count": 3},
        trajectory_path=tmp_path / "none",
        reward_path=reward_path,
        linked=True,
        judge={"verdict": "no"},
    )
    assert scores == {"reward": 0.0, "linked": 1.0}
    assert json.loads((tmp_path / "details.json").read_text()) == {
        "count": 3,
        "judge": {"verdict": "no"},
    }


def test_started_at_ignores_copied_context() -> None:
    steps = [
        {"source": "user", "timestamp": "2026-09-16T00:10:00Z", "is_copied_context": True},
        {"source": "agent", "timestamp": "2026-09-16T00:20:50.981841Z"},
        {"source": "user", "timestamp": "2026-09-16T00:17:57Z"},
    ]
    started = verify.started_at({"steps": steps})
    assert started is not None and started.isoformat() == "2026-09-16T00:17:57+00:00"
    assert verify.started_at({"steps": [{"source": "user"}]}) is None


def _json_bodies_match(request1: VCRRequest, request2: VCRRequest) -> None:
    """The recorded cassette has no content-type header, so VCR's own body matcher
    compares raw bytes and breaks whenever the OpenAI client reorders JSON keys."""
    assert json.loads(request1.body) == json.loads(request2.body)
