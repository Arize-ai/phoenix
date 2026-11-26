# pyright: reportPrivateUsage=false
from dataclasses import dataclass, field
from typing import Any, Optional, Union

from phoenix.client.resources.experiments.evaluators import wrap_phoenix_evals_evaluator
from phoenix.client.resources.experiments.types import ScoreResult


@dataclass
class _FakeScore:
    name: Optional[str]
    score: Optional[Union[float, int]]
    label: Optional[str] = None
    explanation: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)
    source: str = "llm"
    direction: str = "maximize"


@dataclass
class _FakeEvalsEvaluator:
    name: str
    source: str
    scores: ScoreResult
    direction: str = "maximize"
    input_schema: Any = None

    def evaluate(self, input: dict[str, Any]) -> ScoreResult:
        return self.scores

    async def async_evaluate(self, input: dict[str, Any]) -> ScoreResult:
        return self.scores


def test_multi_criterion_scores_all_recorded() -> None:
    evaluator = _FakeEvalsEvaluator(
        name="support_review",
        source="llm",
        scores=[
            _FakeScore(name="helpfulness", score=1, label="helpful"),
            _FakeScore(name="professionalism", score=0, label="unprofessional"),
            _FakeScore(name="resolution", score=1, label="resolved"),
        ],
    )

    result = wrap_phoenix_evals_evaluator(evaluator).evaluate(output="x")

    assert isinstance(result, list)
    assert [evaluation.get("name") for evaluation in result] == [
        "helpfulness",
        "professionalism",
        "resolution",
    ]
    assert [evaluation.get("score") for evaluation in result] == [1.0, 0.0, 1.0]
    assert [evaluation.get("label") for evaluation in result] == [
        "helpful",
        "unprofessional",
        "resolved",
    ]


async def test_multi_criterion_scores_all_recorded_async() -> None:
    evaluator = _FakeEvalsEvaluator(
        name="support_review",
        source="llm",
        scores=[
            _FakeScore(name="helpfulness", score=1, label="helpful"),
            _FakeScore(name="professionalism", score=0, label="unprofessional"),
        ],
    )

    result = await wrap_phoenix_evals_evaluator(evaluator).async_evaluate(output="x")

    assert isinstance(result, list)
    assert [evaluation.get("name") for evaluation in result] == ["helpfulness", "professionalism"]


def test_single_score_returns_one_evaluation() -> None:
    evaluator = _FakeEvalsEvaluator(
        name="sentiment",
        source="llm",
        scores=_FakeScore(name="sentiment", score=1, label="positive"),
    )

    result = wrap_phoenix_evals_evaluator(evaluator).evaluate(output="x")

    assert isinstance(result, dict)
    assert result.get("name") == "sentiment"
    assert result.get("label") == "positive"
