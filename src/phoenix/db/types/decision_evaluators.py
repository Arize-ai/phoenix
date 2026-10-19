"""Versioned scoring policies for native decision evaluators."""

import math
from typing import Annotated, Any, Literal, Optional, Union

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


class _ProjectionModel(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_assignment=True)


class PredicateProjection(_ProjectionModel):
    type: Literal["predicate"] = "predicate"
    threshold: float = Field(default=0.5, ge=0, le=1, allow_inf_nan=False)
    optimization_direction: OptimizationDirection = OptimizationDirection.NONE


class ChoiceProjection(_ProjectionModel):
    type: Literal["choice"] = "choice"
    scores: dict[str, float] = Field(default_factory=dict)
    optimization_direction: OptimizationDirection = OptimizationDirection.NONE

    @model_validator(mode="after")
    def finite_scores(self) -> Self:
        if any(not math.isfinite(score) for score in self.scores.values()):
            raise ValueError("Choice scores must be finite")
        return self


class ScaleProjection(_ProjectionModel):
    type: Literal["scale"] = "scale"
    include_label: bool = False
    optimization_direction: OptimizationDirection = OptimizationDirection.NONE


DecisionQuestionProjection = Annotated[
    Union[PredicateProjection, ChoiceProjection, ScaleProjection], Field(discriminator="type")
]


class DecisionProjectionPolicy(_ProjectionModel):
    schema_version: Literal[1] = 1
    questions: dict[str, DecisionQuestionProjection] = Field(default_factory=dict)


def resolve_projection_policy(
    questions: list[DecisionQuestion], policy: DecisionProjectionPolicy
) -> DecisionProjectionPolicy:
    """Materialize defaults and reject policies inconsistent with their question definitions."""
    if unknown := policy.questions.keys() - {question.name for question in questions}:
        raise ValueError(f"Unknown projection questions: {', '.join(sorted(unknown))}")
    resolved: dict[str, DecisionQuestionProjection] = {}
    for question in questions:
        projection = policy.questions.get(question.name)
        if projection is None:
            if question.type == "predicate":
                projection = PredicateProjection()
            elif question.type == "choice":
                projection = ChoiceProjection()
            else:
                projection = ScaleProjection()
        if projection.type != question.type:
            raise ValueError(f"Projection type for {question.name} must be {question.type}")
        if isinstance(projection, ChoiceProjection) and isinstance(question, ChoiceQuestion):
            if unknown_choices := projection.scores.keys() - {
                choice.value for choice in question.choices
            }:
                raise ValueError(
                    f"Unknown scored choices for {question.name}: "
                    f"{', '.join(sorted(unknown_choices))}"
                )
        resolved[question.name] = type(projection).model_validate(projection.model_dump())
    return DecisionProjectionPolicy(schema_version=1, questions=resolved)


def derive_decision_output_configs(
    questions: list[DecisionQuestion], policy: DecisionProjectionPolicy
) -> list[OutputConfigType]:
    """Derive structural output schemas directly from the selected decision questions."""
    resolved = resolve_projection_policy(questions, policy)
    configs: list[OutputConfigType] = []
    for question in questions:
        projection = resolved.questions[question.name]
        if isinstance(question, ChoiceQuestion):
            assert isinstance(projection, ChoiceProjection)
            configs.append(
                CategoricalOutputConfig(
                    type="CATEGORICAL",
                    name=question.name,
                    optimization_direction=projection.optimization_direction,
                    values=[
                        CategoricalAnnotationValue(
                            label=choice.value, score=projection.scores.get(choice.value)
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
                    optimization_direction=projection.optimization_direction,
                    lower_bound=0,
                    upper_bound=1
                    if isinstance(question, PredicateQuestion)
                    else len(question.levels) - 1,
                )
            )
    return configs


def effective_decision_policy(
    questions: list[DecisionQuestion],
    policy: DecisionProjectionPolicy,
    override: Optional[dict[str, Any]] = None,
) -> DecisionProjectionPolicy:
    """Resolve a complete binding override, or inherit the shared evaluator policy."""
    return resolve_projection_policy(
        questions,
        DecisionProjectionPolicy.model_validate(override) if override is not None else policy,
    )
