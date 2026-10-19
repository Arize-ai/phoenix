"""Typed projection policies for saved, dataset-bound, and frozen decision judges."""

from typing import Sequence

import strawberry
from typing_extensions import assert_never

from phoenix.db.types import decision_evaluators as stored
from phoenix.db.types.annotation_configs import OptimizationDirection
from phoenix.db.types.decisions import ChoiceQuestion, DecisionQuestion


@strawberry.type(description="The score a choice question's annotation gets for one choice.")
class DecisionChoiceScore:
    choice: str = strawberry.field(description="The choice's value, as the question declares it.")
    score: float


@strawberry.interface(
    description="How one decision question's answer becomes an annotation's label and score."
)
class DecisionQuestionProjection:
    name: str = strawberry.field(description="The question's name.")
    optimization_direction: OptimizationDirection = strawberry.field(
        description="Whether a higher or lower score is better, for comparisons and charts."
    )


@strawberry.type(
    description=(
        "A predicate's score is the probability that it is true. Its label is `true` when "
        "that probability is at least the threshold, otherwise `false`."
    )
)
class DecisionPredicateProjection(DecisionQuestionProjection):
    threshold: float = strawberry.field(
        description="The probability, in [0, 1], at or above which the label is `true`."
    )


@strawberry.type(
    description=(
        "A choice's label is the chosen value. Its score is the chosen value's configured "
        "score, or null when the value has none."
    )
)
class DecisionChoiceProjection(DecisionQuestionProjection):
    scores: list[DecisionChoiceScore] = strawberry.field(
        description="Scores for some or all of the question's choices, in declared order."
    )


@strawberry.type(
    description=("A scale's score is its expected level, from 0 to the number of levels minus one.")
)
class DecisionScaleProjection(DecisionQuestionProjection):
    include_label: bool = strawberry.field(
        description=(
            "Whether the annotation is also labeled with the most probable level; on a tie, "
            "the first such level."
        )
    )


@strawberry.type(description="How a decision judge's answers become annotations, by question.")
class DecisionProjectionPolicy:
    questions: list[DecisionQuestionProjection] = strawberry.field(
        description="Settings by question, in the order the decision declares its questions."
    )

    @classmethod
    def from_orm(
        cls, policy: stored.DecisionProjectionPolicy, questions: Sequence[DecisionQuestion]
    ) -> "DecisionProjectionPolicy":
        """Expose the stored question map as type-specific objects in declared order.

        The stored map's key order is not kept by every database, so the decision's own
        question and choice lists give the order. A sparse binding override lists only the
        questions it sets.
        """
        declared = {question.name: question for question in questions}
        names = [name for name in declared if name in policy.questions] + sorted(
            name for name in policy.questions if name not in declared
        )
        result: list[DecisionQuestionProjection] = []
        for name in names:
            projection = policy.questions[name]
            if isinstance(projection, stored.PredicateProjection):
                result.append(
                    DecisionPredicateProjection(
                        name=name,
                        optimization_direction=projection.optimization_direction,
                        threshold=projection.threshold,
                    )
                )
            elif isinstance(projection, stored.ChoiceProjection):
                question = declared.get(name)
                order = (
                    [choice.value for choice in question.choices]
                    if isinstance(question, ChoiceQuestion)
                    else []
                )
                choices = [choice for choice in order if choice in projection.scores] + sorted(
                    choice for choice in projection.scores if choice not in order
                )
                result.append(
                    DecisionChoiceProjection(
                        name=name,
                        optimization_direction=projection.optimization_direction,
                        scores=[
                            DecisionChoiceScore(choice=choice, score=projection.scores[choice])
                            for choice in choices
                        ],
                    )
                )
            elif isinstance(projection, stored.ScaleProjection):
                result.append(
                    DecisionScaleProjection(
                        name=name,
                        optimization_direction=projection.optimization_direction,
                        include_label=projection.include_label,
                    )
                )
            else:
                assert_never(projection)
        return cls(questions=result)
