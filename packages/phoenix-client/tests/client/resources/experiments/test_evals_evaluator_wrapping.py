from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Optional

from phoenix.client.resources.experiments import _evaluators_by_name  # pyright: ignore[reportPrivateUsage]
from phoenix.client.resources.experiments.types import EvaluationScore


@dataclass
class _Score:
    name: Optional[str]
    score: Optional[float]
    label: Optional[str] = None
    explanation: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=lambda: {})
    source: str = "heuristic"
    direction: str = "maximize"


class _MultiScoreEvaluator:
    input_schema: Any = None
    direction: str = "maximize"
    source: str = "heuristic"
    name: str = "precision_recall_fscore"

    def __init__(self, scores: list[EvaluationScore]) -> None:
        self._scores = scores

    def evaluate(self, input: dict[str, Any]) -> list[EvaluationScore]:
        return self._scores

    async def async_evaluate(self, input: dict[str, Any]) -> list[EvaluationScore]:
        return self._scores


def _wrap(scores: list[EvaluationScore]) -> Any:
    return next(iter(_evaluators_by_name(_MultiScoreEvaluator(scores)).values()))


def test_all_scores_of_a_multi_score_evals_evaluator_are_kept() -> None:
    wrapped = _wrap(
        [
            _Score(name="precision", score=0.5),
            _Score(name="recall", score=0.25),
            _Score(name="f1", score=1 / 3),
        ]
    )
    expected = [
        {"score": 0.5, "name": "precision"},
        {"score": 0.25, "name": "recall"},
        {"score": 1 / 3, "name": "f1"},
    ]

    assert wrapped.evaluate(output="x") == expected
    assert asyncio.run(wrapped.async_evaluate(output="x")) == expected


def test_single_score_evals_evaluator_still_returns_one_evaluation() -> None:
    wrapped = _wrap([_Score(name="correctness", score=1.0, label="correct")])
    expected = {"score": 1.0, "label": "correct", "name": "correctness"}

    assert wrapped.evaluate(output="x") == expected
    assert asyncio.run(wrapped.async_evaluate(output="x")) == expected
