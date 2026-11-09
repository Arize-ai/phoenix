"""GraphQL output types for a decision's definition: its state template and questions.

They mirror the input types in ``DecisionVersionInput`` and are built from the stored types
in :mod:`phoenix.db.types.decisions`.
"""

from typing import Annotated, Optional, Union

import strawberry
from strawberry.scalars import JSON
from typing_extensions import assert_never

from phoenix.db.types import decisions as stored


@strawberry.type(
    description="The state is text: a template rendered with the decision's template format."
)
class DecisionTextState:
    text: str = strawberry.field(description="The text template.")


@strawberry.type(
    description="The state is JSON: any JSON value whose string leaves are templates. A string "
    "that is exactly one variable tag is replaced by the variable's value with its JSON type "
    "kept; other strings render as text. Object keys are literal."
)
class DecisionJsonState:
    json: JSON = strawberry.field(description="The JSON template.")


DecisionState = Annotated[
    Union[DecisionTextState, DecisionJsonState],
    strawberry.union(name="DecisionState"),
]


@strawberry.type
class DecisionPredicateCriteria:
    true: Optional[str]
    false: Optional[str]


@strawberry.type(description="A statement answered with the probability that it is true.")
class DecisionPredicateQuestion:
    name: str
    instructions: str
    criteria: Optional[DecisionPredicateCriteria]


@strawberry.type
class DecisionChoiceOption:
    value: str
    description: Optional[str]


@strawberry.type(description="One option from a fixed set.")
class DecisionChoiceQuestion:
    name: str
    instructions: str
    choices: list[DecisionChoiceOption]


@strawberry.type
class DecisionScaleLevel:
    label: str
    description: Optional[str]


@strawberry.type(description="Ordered levels; a level's position, from zero, is its value.")
class DecisionScaleQuestion:
    name: str
    instructions: str
    levels: list[DecisionScaleLevel]


DecisionQuestion = Annotated[
    Union[DecisionPredicateQuestion, DecisionChoiceQuestion, DecisionScaleQuestion],
    strawberry.union(name="DecisionQuestion"),
]


def to_gql_decision_state(state: stored.DecisionState) -> DecisionState:
    if isinstance(state, stored.TextState):
        return DecisionTextState(text=state.template)
    if isinstance(state, stored.JsonState):
        return DecisionJsonState(json=JSON(state.template))
    assert_never(state)


def to_gql_decision_question(question: stored.DecisionQuestion) -> DecisionQuestion:
    if isinstance(question, stored.PredicateQuestion):
        return DecisionPredicateQuestion(
            name=question.name,
            instructions=question.instructions,
            criteria=DecisionPredicateCriteria(
                true=question.criteria.true, false=question.criteria.false
            )
            if question.criteria
            else None,
        )
    if isinstance(question, stored.ChoiceQuestion):
        return DecisionChoiceQuestion(
            name=question.name,
            instructions=question.instructions,
            choices=[
                DecisionChoiceOption(value=option.value, description=option.description)
                for option in question.choices
            ],
        )
    if isinstance(question, stored.ScaleQuestion):
        return DecisionScaleQuestion(
            name=question.name,
            instructions=question.instructions,
            levels=[
                DecisionScaleLevel(label=level.label, description=level.description)
                for level in question.levels
            ],
        )
    assert_never(question)
