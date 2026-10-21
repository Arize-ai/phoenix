"""GraphQL output types for a decision's definition: its inputs, state, and questions.

They mirror the input types in ``DecisionVersionInput`` and are built from the stored types
in :mod:`phoenix.db.types.decisions`.
"""

from typing import Annotated, Optional, Union

import strawberry
from strawberry.scalars import JSON
from typing_extensions import assert_never

from phoenix.db.types import decisions as stored
from phoenix.server.api.input_types.DecisionVersionInput import DecisionTemplateFormat


@strawberry.type(description="One named input a decision's state is built from.")
class DecisionInputDefinition:
    name: str
    description: Optional[str]
    json_schema: Optional[JSON] = strawberry.field(
        description="Describes the value for the playground form. Not enforced on a run."
    )


@strawberry.type(description="The state is the declared inputs, as a JSON object.")
class DecisionObjectState:
    object: bool = True


@strawberry.type(description="The state is a text template rendered over the inputs.")
class DecisionTextState:
    template: str
    template_format: DecisionTemplateFormat


@strawberry.type(description="The state is one input's value, unchanged.")
class DecisionInputState:
    input: str


DecisionState = Annotated[
    Union[DecisionObjectState, DecisionTextState, DecisionInputState],
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


def to_gql_decision_input(input: stored.DecisionInput) -> DecisionInputDefinition:
    return DecisionInputDefinition(
        name=input.name,
        description=input.description,
        json_schema=JSON(input.json_schema) if input.json_schema is not None else None,
    )


def to_gql_decision_state(state: stored.DecisionState) -> DecisionState:
    if isinstance(state, stored.ObjectState):
        return DecisionObjectState()
    if isinstance(state, stored.TextState):
        return DecisionTextState(
            template=state.template, template_format=DecisionTemplateFormat(state.template_format)
        )
    if isinstance(state, stored.InputState):
        return DecisionInputState(input=state.name)
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
