"""Typed scoring settings for native decision evaluators."""

from typing import Optional

import strawberry
from pydantic import ValidationError
from strawberry import UNSET

from phoenix.db.types import decision_evaluators as stored
from phoenix.db.types.annotation_configs import OptimizationDirection
from phoenix.server.api.exceptions import BadRequest


@strawberry.input(description="The score for one of a choice question's declared choices.")
class DecisionChoiceScoreInput:
    choice: str
    score: float


@strawberry.input(description="Scoring for a predicate question.")
class DecisionPredicateScoringInput:
    name: str
    threshold: float = strawberry.field(
        default=0.5,
        description="The probability, in [0, 1], at or above which the label is `true`.",
    )
    optimization_direction: OptimizationDirection = OptimizationDirection.NONE


@strawberry.input(description="Scoring for a choice question.")
class DecisionChoiceScoringInput:
    name: str
    scores: list[DecisionChoiceScoreInput] = strawberry.field(
        default_factory=list,
        description="Scores by choice; a choice left out gets a null score.",
    )
    optimization_direction: OptimizationDirection = OptimizationDirection.NONE


@strawberry.input(description="Scoring for a scale question; its score is the expected level.")
class DecisionScaleScoringInput:
    name: str
    include_label: bool = strawberry.field(
        default=False, description="Also label the annotation with the most probable level."
    )
    optimization_direction: OptimizationDirection = OptimizationDirection.NONE


@strawberry.input(one_of=True, description="Scoring settings for one named decision question.")
class DecisionQuestionScoringInput:
    predicate: Optional[DecisionPredicateScoringInput] = UNSET
    choice: Optional[DecisionChoiceScoringInput] = UNSET
    scale: Optional[DecisionScaleScoringInput] = UNSET

    def to_orm(self) -> tuple[str, stored.DecisionQuestionScoring]:
        """Convert the selected question settings to the stored policy representation."""
        if self.predicate:
            return self.predicate.name, stored.PredicateScoring(
                type="predicate",
                threshold=self.predicate.threshold,
                optimization_direction=self.predicate.optimization_direction,
            )
        if self.choice:
            scores = {}
            for value in self.choice.scores:
                if value.choice in scores:
                    raise BadRequest(f"Duplicate score for choice '{value.choice}'")
                scores[value.choice] = value.score
            return self.choice.name, stored.ChoiceScoring(
                type="choice",
                scores=scores,
                optimization_direction=self.choice.optimization_direction,
            )
        if self.scale:
            return self.scale.name, stored.ScaleScoring(
                type="scale",
                include_label=self.scale.include_label,
                optimization_direction=self.scale.optimization_direction,
            )
        raise BadRequest("Exactly one scoring type must be provided")


@strawberry.input(
    description=(
        "Scoring settings by question. A question left out keeps its default, or on a "
        "dataset binding, the judge's own setting."
    )
)
class DecisionScoringPolicyInput:
    questions: list[DecisionQuestionScoringInput] = strawberry.field(default_factory=list)

    def to_orm(self) -> stored.DecisionScoringPolicy:
        """Validate typed settings without silently dropping duplicate question names."""
        # TODO: policies are validated several times per request (to_orm -> model_dump ->
        # model_validate). Harmless; tidy when touching this.
        questions: dict[str, stored.DecisionQuestionScoring] = {}
        for value in self.questions:
            settings = (value.predicate, value.choice, value.scale)
            name = next((setting.name for setting in settings if setting), None)
            if name is None:
                raise BadRequest("Exactly one scoring type must be provided")
            try:
                _, scoring = value.to_orm()
            except ValidationError as error:
                detail = "; ".join(
                    f"{'.'.join(map(str, e['loc']))}: {e['msg']}" if e["loc"] else str(e["msg"])
                    for e in error.errors(include_input=False)
                )
                raise BadRequest(f"Scoring for question '{name}': {detail}") from error
            if name in questions:
                raise BadRequest(f"Duplicate scoring question '{name}'")
            questions[name] = scoring
        return stored.DecisionScoringPolicy(questions=questions)
