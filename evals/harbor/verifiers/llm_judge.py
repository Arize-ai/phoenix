"""LLM-as-a-judge evaluators for the Harbor verifiers, built on ``phoenix.evals``.

The judge model defaults to a cheap one and is overridable with
``PHOENIX_EVAL_JUDGE_MODEL`` (and ``PHOENIX_EVAL_JUDGE_PROVIDER``). The task's
``[verifier]`` table must allow the provider's host.
"""

from __future__ import annotations

import os

from phoenix.evals import LLM, ClassificationEvaluator, Score

JUDGE_PROVIDER = os.environ.get("PHOENIX_EVAL_JUDGE_PROVIDER", "anthropic")
JUDGE_MODEL = os.environ.get("PHOENIX_EVAL_JUDGE_MODEL", "claude-haiku-4-5")

_REFERENCE_TEMPLATE = """You are grading the final reply of an AI agent that was asked a question about data in an observability tool. You are given the reference answer.

Decide whether the reply commits to the same final answer as the reference. Wording, formatting, units, extra correct context, and rounding to the reference's precision do not matter. The reply does not match when it states a different value, hedges between candidate answers, answers a different question, or gives no answer.
{{notes}}
[BEGIN REFERENCE ANSWER]
{{reference}}
[END REFERENCE ANSWER]

[BEGIN AGENT REPLY]
{{reply}}
[END AGENT REPLY]

Does the reply commit to the same final answer as the reference?"""


def reply_matches_reference(reply: str, reference: str, notes: str = "") -> Score:
    """Whether ``reply`` commits to the same final answer as ``reference``.

    ``notes`` is optional guidance for the judge, such as alternative names for
    the same entity.
    """
    evaluator = ClassificationEvaluator(
        name="reply_matches_reference",
        llm=LLM(provider=JUDGE_PROVIDER, model=JUDGE_MODEL),
        prompt_template=_REFERENCE_TEMPLATE,
        choices={"match": 1.0, "mismatch": 0.0},
    )
    guidance = f"\nAdditional guidance: {notes.strip()}\n" if notes.strip() else ""
    scores = evaluator.evaluate(
        {"reply": reply or "(empty reply)", "reference": reference, "notes": guidance}
    )
    return scores[0]
