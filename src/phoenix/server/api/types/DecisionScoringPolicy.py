"""Typed scoring policies for saved, dataset-bound, and captured decision evaluators."""

from typing import Optional, Sequence

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
class DecisionQuestionScoring:
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
class DecisionPredicateScoring(DecisionQuestionScoring):
    threshold: float = strawberry.field(
        description="The probability, in [0, 1], at or above which the label is `true`."
    )


@strawberry.type(
    description=(
        "A choice's label is the chosen value. Its score is the chosen value's configured "
        "score, or null when the value has none."
    )
)
class DecisionChoiceScoring(DecisionQuestionScoring):
    scores: list[DecisionChoiceScore] = strawberry.field(
        description="Scores for some or all of the question's choices, in declared order."
    )


@strawberry.type(
    description=("A scale's score is its expected level, from 0 to the number of levels minus one.")
)
class DecisionScaleScoring(DecisionQuestionScoring):
    include_label: bool = strawberry.field(
        description=(
            "Whether the annotation is also labeled with the most probable level; on a tie, "
            "the first such level."
        )
    )


@strawberry.type(description="How a decision evaluator's answers become annotations, by question.")
class DecisionScoringPolicy:
    questions: list[DecisionQuestionScoring] = strawberry.field(
        description="Settings by question, in the order the decision declares its questions."
    )

    @classmethod
    def from_orm(
        cls, policy: stored.DecisionScoringPolicy, questions: Sequence[DecisionQuestion]
    ) -> "DecisionScoringPolicy":
        """Expose the stored question map as type-specific objects in declared order.

        The stored map's key order is not kept by every database, so the decision's own
        question and choice lists give the order. A sparse binding override lists only the
        questions it sets.
        """
        declared = {question.name: question for question in questions}
        names = [name for name in declared if name in policy.questions] + sorted(
            name for name in policy.questions if name not in declared
        )
        result: list[DecisionQuestionScoring] = []
        for name in names:
            question = declared.get(name)
            result.append(
                to_gql_question_scoring(
                    name,
                    policy.questions[name],
                    [choice.value for choice in question.choices]
                    if isinstance(question, ChoiceQuestion)
                    else None,
                )
            )
        return cls(questions=result)


def to_gql_question_scoring(
    name: str,
    scoring: stored.DecisionQuestionScoring,
    choice_order: Optional[Sequence[str]] = None,
) -> DecisionQuestionScoring:
    """One question's settings. A choice's scores follow ``choice_order`` when given,
    then any other scored values sorted."""
    if isinstance(scoring, stored.PredicateScoring):
        return DecisionPredicateScoring(
            name=name,
            optimization_direction=scoring.optimization_direction,
            threshold=scoring.threshold,
        )
    if isinstance(scoring, stored.ChoiceScoring):
        order = list(choice_order or [])
        choices = [choice for choice in order if choice in scoring.scores] + sorted(
            choice for choice in scoring.scores if choice not in order
        )
        return DecisionChoiceScoring(
            name=name,
            optimization_direction=scoring.optimization_direction,
            scores=[
                DecisionChoiceScore(choice=choice, score=scoring.scores[choice])
                for choice in choices
            ],
        )
    if isinstance(scoring, stored.ScaleScoring):
        return DecisionScaleScoring(
            name=name,
            optimization_direction=scoring.optimization_direction,
            include_label=scoring.include_label,
        )
    assert_never(scoring)
