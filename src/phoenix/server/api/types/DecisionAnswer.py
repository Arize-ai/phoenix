from typing import Optional, Sequence

import strawberry

from phoenix.db.types.decisions import ChoiceQuestion
from phoenix.db.types.decisions import DecisionQuestion as StoredDecisionQuestion
from phoenix.server.api.helpers import decision_clients


@strawberry.interface(description="One answer, in Phoenix's vocabulary whatever the provider.")
class DecisionAnswer:
    name: str = strawberry.field(description="The name of the question this answers.")


@strawberry.type
class PredicateAnswer(DecisionAnswer):
    probability: float = strawberry.field(description="The probability that the statement is true.")


@strawberry.type
class ChoiceProbability:
    value: str
    probability: float


@strawberry.type
class ChoiceAnswer(DecisionAnswer):
    choice: str
    confidence: float = strawberry.field(
        description=(
            "The model's certainty in `choice`, from 0 to 1, for flagging answers to review. "
            "It is not a probability; see `probabilities`."
        )
    )
    probabilities: list[ChoiceProbability] = strawberry.field(
        description="Probability per choice value, in the question's order."
    )


@strawberry.type
class LevelProbability:
    level: int = strawberry.field(description="The level's position, from zero.")
    probability: float


@strawberry.type
class ScaleAnswer(DecisionAnswer):
    expected_level: float = strawberry.field(
        description=(
            "The probability-weighted average of the levels. It can fall between levels "
            "and is never a discrete level."
        )
    )
    confidence: float = strawberry.field(
        description=(
            "The model's certainty in `expectedLevel`, from 0 to 1, for flagging answers to "
            "review. It is not a probability; see `probabilities`."
        )
    )
    probabilities: list[LevelProbability] = strawberry.field(
        description="Probability per level, from the lowest."
    )


@strawberry.type(description="The model declined to answer this question.")
class RefusalAnswer(DecisionAnswer):
    pass


@strawberry.type
class DecisionUsage:
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None


@strawberry.type(description="A successful decision run.")
class DecisionResult:
    model: str = strawberry.field(description="The model that answered, after alias resolution.")
    answers: list[DecisionAnswer] = strawberry.field(
        description="One answer per question, in the order the questions were given."
    )
    usage: DecisionUsage


def to_gql_decision_answer(
    question: StoredDecisionQuestion, answer: decision_clients.DecisionAnswer
) -> DecisionAnswer:
    """Convert a validated answer; ``question`` supplies its name and probability order."""
    if isinstance(answer, decision_clients.ChoiceAnswer) and not isinstance(
        question, ChoiceQuestion
    ):
        raise ValueError(f"Unexpected answer type {answer.type!r} for {question.name}")
    return to_gql_answer(
        question.name,
        answer,
        [option.value for option in question.choices]
        if isinstance(question, ChoiceQuestion)
        else None,
    )


def to_gql_answer(
    name: str,
    answer: decision_clients.DecisionAnswer,
    choice_order: Optional[Sequence[str]] = None,
) -> DecisionAnswer:
    """Convert an answer to the question ``name``. A choice's probabilities follow
    ``choice_order`` when given, and the answer's own order otherwise."""
    if isinstance(answer, decision_clients.PredicateAnswer):
        return PredicateAnswer(name=name, probability=answer.probability)
    if isinstance(answer, decision_clients.ChoiceAnswer):
        order = list(choice_order or [])
        values = [value for value in order if value in answer.probabilities] + [
            value for value in answer.probabilities if value not in order
        ]
        return ChoiceAnswer(
            name=name,
            choice=answer.choice,
            confidence=answer.confidence,
            probabilities=[
                ChoiceProbability(value=value, probability=answer.probabilities[value])
                for value in values
            ],
        )
    if isinstance(answer, decision_clients.ScaleAnswer):
        return ScaleAnswer(
            name=name,
            expected_level=answer.expected_level,
            confidence=answer.confidence,
            probabilities=[
                LevelProbability(level=level, probability=answer.probabilities[level])
                for level in sorted(answer.probabilities)
            ],
        )
    if isinstance(answer, decision_clients.RefusalAnswer):
        return RefusalAnswer(name=name)
    raise ValueError(f"Unexpected answer type {answer.type!r} for {name}")


def to_gql_decision_result(
    request: decision_clients.DecisionRequest, response: decision_clients.DecisionResponse
) -> DecisionResult:
    return DecisionResult(
        model=response.model,
        answers=[
            to_gql_decision_answer(question, response.answers[question.name])
            for question in request.questions
        ],
        usage=DecisionUsage(
            input_tokens=response.input_tokens, output_tokens=response.output_tokens
        ),
    )
