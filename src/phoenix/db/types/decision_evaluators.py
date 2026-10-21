"""Versioned scoring policies for native decision evaluators."""

import math
from typing import Annotated, Literal, Union

from pydantic import Field, model_validator
from typing_extensions import Self

from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OptimizationDirection,
    OutputConfigType,
)
from phoenix.db.types.db_helper_types import DBBaseModel
from phoenix.db.types.decisions import ChoiceQuestion, DecisionQuestion, PredicateQuestion


class PredicateScoring(DBBaseModel):
    type: Literal["predicate"]
    threshold: float = Field(default=0.5, ge=0, le=1, allow_inf_nan=False)
    optimization_direction: OptimizationDirection = OptimizationDirection.NONE


class ChoiceScoring(DBBaseModel):
    type: Literal["choice"]
    scores: dict[str, float] = Field(default_factory=dict)
    optimization_direction: OptimizationDirection = OptimizationDirection.NONE

    @model_validator(mode="after")
    def finite_scores(self) -> Self:
        if any(not math.isfinite(score) for score in self.scores.values()):
            raise ValueError("Choice scores must be finite")
        return self


class ScaleScoring(DBBaseModel):
    type: Literal["scale"]
    include_label: bool = False
    optimization_direction: OptimizationDirection = OptimizationDirection.NONE


DecisionQuestionScoring = Annotated[
    Union[PredicateScoring, ChoiceScoring, ScaleScoring], Field(discriminator="type")
]


class DecisionScoringPolicy(DBBaseModel):
    """Question thresholds, choice scores, scale labels, and comparison direction."""

    questions: dict[str, DecisionQuestionScoring] = Field(default_factory=dict)


def _default_scoring(question: DecisionQuestion) -> DecisionQuestionScoring:
    if question.type == "predicate":
        return PredicateScoring(type="predicate")
    if question.type == "choice":
        return ChoiceScoring(type="choice")
    return ScaleScoring(type="scale")


def resolve_scoring_policy(
    questions: list[DecisionQuestion], policy: DecisionScoringPolicy
) -> DecisionScoringPolicy:
    """Materialize defaults and reject policies inconsistent with their question definitions."""
    if unknown := policy.questions.keys() - {question.name for question in questions}:
        raise ValueError(f"Unknown scoring questions: {', '.join(sorted(unknown))}")
    resolved: dict[str, DecisionQuestionScoring] = {}
    for question in questions:
        scoring = policy.questions.get(question.name)
        if scoring is None:
            scoring = _default_scoring(question)
        if scoring.type != question.type:
            raise ValueError(f"Scoring type for {question.name} must be {question.type}")
        if isinstance(scoring, ChoiceScoring) and isinstance(question, ChoiceQuestion):
            if unknown_choices := scoring.scores.keys() - {
                choice.value for choice in question.choices
            }:
                raise ValueError(
                    f"Unknown scored choices for {question.name}: "
                    f"{', '.join(sorted(unknown_choices))}"
                )
        resolved[question.name] = scoring
    return DecisionScoringPolicy(questions=resolved)


def adapt_scoring_policy(
    questions: list[DecisionQuestion], policy: DecisionScoringPolicy
) -> DecisionScoringPolicy:
    """Carry a saved policy to another version's questions, then materialize defaults.

    Settings for a question that is gone or changed type are dropped, as are scores for
    choices the question no longer offers; a new question gets defaults.
    """
    resolved: dict[str, DecisionQuestionScoring] = {}
    for question in questions:
        scoring = policy.questions.get(question.name)
        if scoring is None or scoring.type != question.type:
            scoring = _default_scoring(question)
        elif isinstance(scoring, ChoiceScoring) and isinstance(question, ChoiceQuestion):
            offered = {choice.value for choice in question.choices}
            scoring = scoring.model_copy(
                update={
                    "scores": {
                        choice: score
                        for choice, score in scoring.scores.items()
                        if choice in offered
                    }
                }
            )
        resolved[question.name] = scoring
    return DecisionScoringPolicy(questions=resolved)


def derive_decision_output_configs(
    questions: list[DecisionQuestion], policy: DecisionScoringPolicy
) -> list[OutputConfigType]:
    """Derive structural output schemas directly from the selected decision questions."""
    resolved = resolve_scoring_policy(questions, policy)
    configs: list[OutputConfigType] = []
    for question in questions:
        scoring = resolved.questions[question.name]
        if isinstance(question, ChoiceQuestion):
            assert isinstance(scoring, ChoiceScoring)
            configs.append(
                CategoricalOutputConfig(
                    type="CATEGORICAL",
                    name=question.name,
                    optimization_direction=scoring.optimization_direction,
                    values=[
                        CategoricalAnnotationValue(
                            label=choice.value, score=scoring.scores.get(choice.value)
                        )
                        for choice in question.choices
                    ],
                )
            )
        else:
            configs.append(
                ContinuousOutputConfig(
                    type="CONTINUOUS",
                    name=question.name,
                    optimization_direction=scoring.optimization_direction,
                    lower_bound=0,
                    upper_bound=1
                    if isinstance(question, PredicateQuestion)
                    else len(question.levels) - 1,
                )
            )
    return configs
