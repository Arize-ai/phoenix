"""Grades an arm's prose answer against the deterministic reference.

The efficiency numbers only mean something if the answers are right — an arm
that hallucinates percentiles without fetching anything would otherwise win on
every metric. The judge sees the reference values computed in
``ground_truth.py``, so it checks arithmetic rather than plausibility.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Optional

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from evals.mcp.harness.runner import MODEL_SETTINGS

JUDGE_SYSTEM_PROMPT = """You grade an AI observability analyst's answer against a reference.

The reference was computed deterministically from the same data the analyst had
access to. Treat it as ground truth.

Grade only on factual agreement with the reference and on the rubric's stated
tolerances. Do not reward or penalize style, length, formatting, or extra
commentary that is consistent with the reference.

An answer that omits a value the rubric requires is incorrect, even if
everything it does state is right. An answer that states a number the reference
contradicts is incorrect. An answer that hedges or refuses is incorrect."""


class Verdict(BaseModel):
    """Structured judgement for one answer."""

    correct: bool = Field(description="True only if the answer satisfies the rubric in full.")
    score: float = Field(
        description=(
            "Fraction of the rubric's required facts that are present and agree with "
            "the reference, from 0.0 to 1.0."
        ),
        ge=0.0,
        le=1.0,
    )
    explanation: str = Field(
        description="One or two sentences naming the specific values that matched or conflicted."
    )


@dataclass
class Judgement:
    """A verdict paired with the run it grades."""

    arm: str
    question_id: str
    #: Mirrors ``RunResult.repeat`` — the three fields together identify which
    #: run this verdict belongs to.
    repeat: int
    correct: bool
    score: float
    explanation: str
    error: Optional[str] = None


def _build_judge(model: str) -> Agent[None, Verdict]:
    return Agent(
        model,
        system_prompt=JUDGE_SYSTEM_PROMPT,
        output_type=Verdict,
        model_settings=MODEL_SETTINGS,
    )


async def judge_answer(
    *,
    model: str,
    arm: str,
    question_id: str,
    repeat: int,
    prompt: str,
    rubric: str,
    answer: str,
    reference: Any,
) -> Judgement:
    """Grade one answer. A judge failure is recorded, never raised."""
    if not answer.strip():
        return Judgement(
            arm=arm,
            question_id=question_id,
            repeat=repeat,
            correct=False,
            score=0.0,
            explanation="The arm produced no answer.",
        )

    reference_block = (
        json.dumps(reference, indent=2, sort_keys=True)
        if reference is not None
        else "(no mechanical reference; grade on the rubric alone)"
    )
    task = f"""QUESTION
{prompt}

RUBRIC
{rubric}

REFERENCE (ground truth)
{reference_block}

ANSWER UNDER TEST
{answer}"""

    try:
        result = await _build_judge(model).run(task)
    except Exception as exc:  # noqa: BLE001
        return Judgement(
            arm=arm,
            question_id=question_id,
            repeat=repeat,
            correct=False,
            score=0.0,
            explanation="Judge failed to return a verdict.",
            error=f"{type(exc).__name__}: {exc}",
        )

    verdict = result.output
    return Judgement(
        arm=arm,
        question_id=question_id,
        repeat=repeat,
        correct=verdict.correct,
        score=verdict.score,
        explanation=verdict.explanation,
    )
