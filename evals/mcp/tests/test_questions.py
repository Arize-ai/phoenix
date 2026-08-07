"""One phoenix-recorded test per benchmark question.

Each test runs the session's arm on one question, grades the prose answer
against the deterministic reference, and records everything three ways:

- ``log_output`` / ``log_evaluation`` — the answer, the LLM judge's verdict,
  and the per-run cost metrics land as experiment-run annotations, so
  successive arms' experiments compare metric-by-metric in the Phoenix UI;
- ``record_property`` — the full run row travels to the conftest, which writes
  the session artifact the offline tools consume;
- plain asserts — a failed run or a wrong answer fails the pytest item, so the
  pass/fail column (and the plugin's ``pass`` annotation) is judged
  correctness, not merely "the harness didn't crash".

Asserts come last: a wrong answer is a datapoint first, so everything is
recorded before the item is allowed to fail.
"""

# ruff: noqa: I001 -- repository import formatter and lint resolver disagree on local `evals`.

from __future__ import annotations

import json
from typing import Any

import pytest

from evals.mcp.harness.arms import Arm
from evals.mcp.harness.environment import BenchmarkConfig
from evals.mcp.harness.judge import judge_answer
from evals.mcp.harness.runner import run_question
from evals.mcp.questions import DATASET_NAME, QUESTIONS, QUESTIONS_BY_ID
from phoenix.client.pytest import log_evaluation, log_output
from phoenix.client.pytest.marker import repetition_index

#: Per-run cost fields surfaced as experiment annotations. Every one of these
#: is also in the session artifact row; annotating them too is what lets the
#: Phoenix experiment-comparison view rank arms without the offline report.
ANNOTATED_METRICS = (
    "turns",
    "tool_calls",
    "tool_retries",
    "total_tokens",
    "catalog_tokens",
    "data_shuttle_tokens",
    "peak_context_tokens",
    "wall_clock_s",
)


@pytest.mark.phoenix(dataset=DATASET_NAME)
@pytest.mark.parametrize("question_id", [q.id for q in QUESTIONS])
async def test_question(
    question_id: str,
    arm: Arm,
    benchmark_config: BenchmarkConfig,
    ground_truth: dict[str, Any],
    no_tools_baseline: int,
    record_property: Any,
    request: Any,
) -> None:
    question = QUESTIONS_BY_ID[question_id]
    repeat = repetition_index(request.node)

    result = await run_question(
        arm=arm,
        question=question,
        model=benchmark_config.model,
        repeat=repeat,
    )
    log_output(result.answer or f"(no answer: {result.error})")

    reference = ground_truth.get(question.reference) if question.reference else None
    judgement = await judge_answer(
        model=benchmark_config.judge_model,
        arm=arm.name,
        question_id=question.id,
        repeat=repeat,
        prompt=question.prompt,
        rubric=question.rubric,
        answer=result.answer,
        reference=reference,
    )
    log_evaluation(
        name="correctness",
        score=judgement.score,
        label="correct" if judgement.correct else "incorrect",
        explanation=judgement.explanation,
        annotator_kind="LLM",
    )

    row = result.to_dict()
    # Netting the baseline out per run (rather than at report time) keeps the
    # session artifact self-contained: catalog cost never needs recomputing.
    row["catalog_tokens"] = max(0, result.first_request_input_tokens - no_tools_baseline)
    for metric in ANNOTATED_METRICS:
        log_evaluation(name=metric, score=float(row[metric]))
    row["correct"] = judgement.correct
    row["score"] = judgement.score
    row["judge_explanation"] = judgement.explanation
    record_property("mcp_run", json.dumps(row))

    assert result.error is None, f"agent run failed: {result.error}"
    assert judgement.correct, judgement.explanation
