import json
from pathlib import Path

import pytest

from evals.mcp.scoring.verify import grade_task_answer as grade_verifier
from evals.mcp.scoring.verify import verify_artifacts

TASKS = Path(__file__).resolve().parents[3] / "evals/mcp/tasks"


def grade_task_answer(task, answer, reference):
    return grade_verifier(TASKS / task / "tests/verify.py", answer, reference)


@pytest.mark.parametrize(
    "answer",
    [
        "117",
        "The project contains 117 traces.",
        "There are **117** traces.",
        "Count: 117",
        "117.",
        "117 traces across 3,579 spans.",
        "117 traces, not spans",
        "117 traces, with no filter applied",
    ],
)
def test_count_accepts_unambiguous_exact_final_answer(answer):
    assert grade_task_answer("count-traces", answer, {"value": 117}) == {"reward": 1}


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
    assert grade_task_answer("count-traces", answer, {"value": 117})["reward"] == 0


def test_missing_truth_is_infrastructure_failure():
    with pytest.raises(ValueError, match="trusted"):
        grade_task_answer("count-traces", "117", {})


def test_task_specific_checks_cover_both_requested_values():
    ref = {"short": 0.8, "long": 14.6}
    assert (
        grade_task_answer(
            "error-rate-by-length", "Short (<15 spans): 0.8%; long (40+): 14.6%", ref
        )["reward"]
        == 1
    )
    assert grade_task_answer("error-rate-by-length", "Short: 5%; long: 14.6%", ref)["reward"] == 0
    assert grade_task_answer("error-rate-by-length", "Long: 14.6%", ref)["reward"] == 0
    ref = {"winners": [["FinderTool", "finder"]], "value": 24}
    assert grade_task_answer("repeated-tool-calls", "FinderTool: 24 calls", ref)["reward"] == 1
    assert grade_task_answer("repeated-tool-calls", "FinderTool: 23 calls", ref)["reward"] == 0
    assert grade_task_answer("repeated-tool-calls", "FinderTool", ref)["reward"] == 0


def test_cost_precision_ties_and_root_cause():
    assert grade_task_answer("total-cost", "$16.0022", {"value": 16.00221})["reward"] == 1
    assert grade_task_answer("total-cost", "16,002 tokens", {"value": 16.00221})["reward"] == 0
    assert grade_task_answer("spend-concentration", "45.3%", {"value": 45.31})["reward"] == 1
    assert grade_task_answer("spend-concentration", "43.1%", {"value": 45.31})["reward"] == 0
    # The inherited prompt does not specify how to round 10% of the trace count.
    shares = {"values": [43.12, 45.31]}
    assert grade_task_answer("spend-concentration", "43.1%", shares)["reward"] == 1
    assert grade_task_answer("spend-concentration", "45.3%", shares)["reward"] == 1
    assert grade_task_answer("spend-concentration", "44.0%", shares)["reward"] == 0
    ref = {"winners": [["PageDownTool", "page_down"], ["OtherTool"]]}
    assert (
        grade_task_answer("most-failing-tool", "page_down and OtherTool tied", ref)["reward"] == 1
    )
    assert grade_task_answer("most-failing-tool", "page_down", ref)["reward"] == 1
    assert (
        grade_task_answer(
            "top-error-category",
            "Formatting Errors",
            {"winners": [["Formatting Errors"], ["Goal Deviation"]]},
        )["reward"]
        == 1
    )
    ref = {"signatures": ["forward() got an unexpected keyword argument 'page'"]}
    assert (
        grade_task_answer(
            "pagedown-root-cause",
            "The caller passes the unsupported keyword page to forward()",
            ref,
        )["reward"]
        == 1
    )
    assert (
        grade_task_answer(
            "pagedown-root-cause", "It gets a TypeError: unexpected keyword argument", ref
        )["reward"]
        == 0
    )
    assert grade_task_answer("pagedown-root-cause", "The server timed out", ref)["reward"] == 0


def test_unavailable_measurements_do_not_change_valid_reward(tmp_path):
    (tmp_path / "workspace").mkdir()
    (tmp_path / "workspace/answer.txt").write_text("117")
    (tmp_path / "evidence").mkdir()
    (tmp_path / "evidence/reference.json").write_text(json.dumps({"count-traces": {"value": 117}}))
    (tmp_path / "evidence/ready.json").write_text('{"ready": true}')
    scores = verify_artifacts(
        tmp_path, "count-traces", "mcp", verifier=TASKS / "count-traces/tests/verify.py"
    )
    assert scores["reward"] == 1
    assert scores["tool_measurement_complete"] == 0
    assert "tool_call_count" not in scores


def test_missing_seed_readiness_cannot_reuse_an_existing_reward(tmp_path):
    reward = tmp_path / "logs/verifier/reward.json"
    reward.parent.mkdir(parents=True)
    reward.write_text('{"reward": 1}')
    with pytest.raises((FileNotFoundError, ValueError)):
        verify_artifacts(
            tmp_path, "count-traces", "mcp", verifier=TASKS / "count-traces/tests/verify.py"
        )
    assert not reward.exists()


def test_signed_cost_and_repetition_answers_do_not_match_positive_truth():
    assert grade_task_answer("total-cost", "$-16.00", {"value": 16})["reward"] == 0
    assert grade_task_answer("spend-concentration", "-45.3%", {"value": 45.3})["reward"] == 0
    assert (
        grade_task_answer(
            "repeated-tool-calls",
            "FinderTool: -24 calls",
            {"value": 24, "winners": [["FinderTool"]]},
        )["reward"]
        == 0
    )
    assert (
        grade_task_answer(
            "error-rate-by-length", "Short: -0.8%; long: 14.6%", {"short": 0.8, "long": 14.6}
        )["reward"]
        == 0
    )


@pytest.mark.parametrize(
    "answer",
    [
        "Short: not 0.8%; long: not 14.6%",
        "Short: not0.8%; long: not14.6%",
        "Short: maybe 0.8%; long: 14.6%",
    ],
)
def test_negated_or_uncertain_group_rates_do_not_match(answer):
    assert (
        grade_task_answer("error-rate-by-length", answer, {"short": 0.8, "long": 14.6})["reward"]
        == 0
    )
