"""Primary semantic evaluator integration. Run only in the trusted verifier."""

from __future__ import annotations

from dataclasses import asdict
from importlib.metadata import version
from typing import Any

from phoenix.evals import LLM
from phoenix.evals.metrics.completeness import CompletenessEvaluator

from runtime import CONFIG
from trajectory import RENDERER_VERSION, RenderedTrajectory


def evaluate_completeness(rendered: RenderedTrajectory, llm: LLM) -> dict[str, Any]:
    record: dict[str, Any] = {
        "evaluator": "phoenix.evals.metrics.completeness.CompletenessEvaluator",
        "evals_version": version("arize-phoenix-evals"),
        "phoenix_revision": CONFIG["phoenix_revision"],
        "renderer_version": RENDERER_VERSION,
        "rendered_input_sha256": rendered.sha256,
        "omitted_fields": rendered.omitted_fields,
        "available": False,
        "scores": [],
        "numeric_rewards": {},
    }
    if rendered.unavailable_reasons:
        return record | {"unavailable_reasons": rendered.unavailable_reasons}
    # The built-in input schema accepts conversation, not unsupported task/reference kwargs.
    scores = CompletenessEvaluator(llm=llm).evaluate({"conversation": rendered.text})
    if len(scores) != 1 or scores[0].score not in (0, 1):
        raise ValueError("Completeness returned no valid binary score")
    return record | {
        "available": True,
        "scores": [asdict(score) for score in scores],
        "numeric_rewards": {"task_completeness": scores[0].score},
    }
