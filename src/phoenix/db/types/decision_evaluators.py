"""Versioned scoring policies for native decision evaluators."""

import math
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing_extensions import Self

from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OptimizationDirection,
    OutputConfigType,
)
from phoenix.db.types.decisions import ChoiceQuestion, DecisionQuestion, PredicateQuestion


class _ScoringModel(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_assignment=True)


class PredicateScoring(_ScoringModel):
    type: Literal["predicate"]
    threshold: float = Field(default=0.5, ge=0, le=1, allow_inf_nan=False)
    optimization_direction: OptimizationDirection = OptimizationDirection.NONE


class ChoiceScoring(_ScoringModel):
    type: Literal["choice"]
    scores: dict[str, float] = Field(default_factory=dict)
    optimization_direction: OptimizationDirection = OptimizationDirection.NONE

    @model_validator(mode="after")
    def finite_scores(self) -> Self:
        if any(not math.isfinite(score) for score in self.scores.values()):
            raise ValueError("Choice scores must be finite")
        return self


class ScaleScoring(_ScoringModel):
    type: Literal["scale"]
    include_label: bool = False
    optimization_direction: OptimizationDirection = OptimizationDirection.NONE


DecisionQuestionScoring = Annotated[
    Union[PredicateScoring, ChoiceScoring, ScaleScoring], Field(discriminator="type")
]


class DecisionScoringPolicy(_ScoringModel):
    """Question thresholds, choice scores, scale labels, and comparison direction."""

    questions: dict[str, DecisionQuestionScoring] = Field(default_factory=dict)


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
            if question.type == "predicate":
                scoring = PredicateScoring(type="predicate")
            elif question.type == "choice":
                scoring = ChoiceScoring(type="choice")
            else:
                scoring = ScaleScoring(type="scale")
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
        resolved[question.name] = type(scoring).model_validate(scoring.model_dump())
    return DecisionScoringPolicy(questions=resolved)


def adapt_scoring_policy(
    questions: list[DecisionQuestion], policy: DecisionScoringPolicy
) -> DecisionScoringPolicy:
    """Carry a saved policy to another version's questions, then materialize defaults.

    Settings for a question that is gone or changed type are dropped, as are scores for
    choices the question no longer offers; a new question gets defaults.
    """
    by_name = {question.name: question for question in questions}
    kept: dict[str, DecisionQuestionScoring] = {}
    for name, scoring in policy.questions.items():
        question = by_name.get(name)
        if question is None or question.type != scoring.type:
            continue
        if isinstance(scoring, ChoiceScoring) and isinstance(question, ChoiceQuestion):
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
        kept[name] = scoring
    return resolve_scoring_policy(questions, DecisionScoringPolicy(questions=kept))


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
