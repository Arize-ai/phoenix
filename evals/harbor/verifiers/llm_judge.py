"""LLM judges for Harbor verifiers.

Set ``PHOENIX_EVAL_JUDGE_MODEL`` and ``PHOENIX_EVAL_JUDGE_PROVIDER`` to override
the defaults. The task's ``[verifier]`` table must allow the provider host.
"""

from __future__ import annotations

import os

from phoenix.evals import LLM, ClassificationEvaluator, Score

JUDGE_PROVIDER = os.environ.get("PHOENIX_EVAL_JUDGE_PROVIDER", "openai")
JUDGE_MODEL = os.environ.get("PHOENIX_EVAL_JUDGE_MODEL", "gpt-5-nano")

_REFERENCE_TEMPLATE = """You are grading the final reply of an AI agent that was asked a question about data in an observability tool. You are given the reference answer.

Decide whether the reply's conclusion semantically matches the reference after applying the grading notes. Treat the grading notes as authoritative. Wording, formatting, explanations, units, extra correct context, and rounding to the reference's precision do not matter. A reply does not match when its conclusion differs, remains uncertain between incompatible candidates, answers a different question, or gives no answer. Mentioning the reference is insufficient if the reply rejects it or ultimately chooses another answer.
{{notes}}
[BEGIN REFERENCE ANSWER]
{{reference}}
[END REFERENCE ANSWER]

[BEGIN AGENT REPLY]
{{reply}}
[END AGENT REPLY]

Does the reply's conclusion semantically match the reference after applying the grading notes?"""


def matches_reference(reply: str, reference: str, notes: str = "") -> Score:
    """Use ``notes`` for equivalent terms or other grading rules."""
    evaluator = ClassificationEvaluator(
        name="matches_reference",
        llm=LLM(provider=JUDGE_PROVIDER, model=JUDGE_MODEL),
        prompt_template=_REFERENCE_TEMPLATE,
        choices={"match": 1.0, "mismatch": 0.0},
    )
    guidance = f"\nAuthoritative grading notes: {notes.strip()}\n" if notes.strip() else ""
    scores = evaluator.evaluate(
        {"reply": reply or "(empty reply)", "reference": reference, "notes": guidance}
    )
    return scores[0]
