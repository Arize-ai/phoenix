from enum import Enum
from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.scalars import JSON

from phoenix.db.types.decisions import (
    ChoiceOption,
    ChoiceQuestion,
    DecisionInput,
    DecisionQuestion,
    DecisionState,
    InputState,
    ObjectState,
    PredicateCriteria,
    PredicateQuestion,
    ScaleLevel,
    ScaleQuestion,
    TextState,
)
from phoenix.server.api.exceptions import BadRequest


@strawberry.input(description="What counts as true and as false; either may be omitted.")
class PredicateCriteriaInput:
    true: Optional[str] = strawberry.field(default=None, description="What counts as true.")
    false: Optional[str] = strawberry.field(default=None, description="What counts as false.")

    def to_orm(self) -> PredicateCriteria:
        return PredicateCriteria(true=self.true, false=self.false)


@strawberry.input(
    description="A statement or yes/no question, answered with the probability that it is true."
)
class PredicateQuestionInput:
    name: str = strawberry.field(description="The name the answer is returned under.")
    instructions: str
    criteria: Optional[PredicateCriteriaInput] = None

    def to_orm(self) -> PredicateQuestion:
        return PredicateQuestion(
            type="predicate",
            name=self.name,
            instructions=self.instructions,
            criteria=self.criteria.to_orm() if self.criteria is not None else None,
        )


@strawberry.input
class ChoiceOptionInput:
    value: str
    description: Optional[str] = None

    def to_orm(self) -> ChoiceOption:
        return ChoiceOption(value=self.value, description=self.description)


@strawberry.input(description="One option from a fixed set of 2–255.")
class ChoiceQuestionInput:
    name: str = strawberry.field(description="The name the answer is returned under.")
    instructions: str
    choices: list[ChoiceOptionInput]

    def to_orm(self) -> ChoiceQuestion:
        return ChoiceQuestion(
            type="choice",
            name=self.name,
            instructions=self.instructions,
            choices=[option.to_orm() for option in self.choices],
        )


@strawberry.input
class ScaleLevelInput:
    label: str
    description: Optional[str] = None

    def to_orm(self) -> ScaleLevel:
        return ScaleLevel(label=self.label, description=self.description)


@strawberry.input(description="2–10 ordered levels; a level's position, from zero, is its value.")
class ScaleQuestionInput:
    name: str = strawberry.field(description="The name the answer is returned under.")
    instructions: str
    levels: list[ScaleLevelInput]

    def to_orm(self) -> ScaleQuestion:
        return ScaleQuestion(
            type="scale",
            name=self.name,
            instructions=self.instructions,
            levels=[level.to_orm() for level in self.levels],
        )


@strawberry.input(one_of=True, description="One decision question. Exactly one type must be set.")
class DecisionQuestionInput:
    predicate: Optional[PredicateQuestionInput] = UNSET
    choice: Optional[ChoiceQuestionInput] = UNSET
    scale: Optional[ScaleQuestionInput] = UNSET

    def to_orm(self) -> DecisionQuestion:
        if self.predicate:
            return self.predicate.to_orm()
        if self.choice:
            return self.choice.to_orm()
        if self.scale:
            return self.scale.to_orm()
        raise ValueError("DecisionQuestionInput: no field is set")


@strawberry.input(description="One named input a caller passes.")
class DecisionInputDefinitionInput:
    name: str
    description: Optional[str] = None
    json_schema: Optional[JSON] = strawberry.field(
        default=None,
        description="Describes the value for the playground form. Not enforced on a run.",
    )

    def to_orm(self) -> DecisionInput:
        if self.json_schema is not None and not isinstance(self.json_schema, dict):
            raise BadRequest(f"jsonSchema for input {self.name!r} must be an object")
        return DecisionInput(
            name=self.name, description=self.description, json_schema=self.json_schema
        )


@strawberry.enum
class DecisionTemplateFormat(Enum):
    MUSTACHE = "MUSTACHE"
    F_STRING = "F_STRING"


@strawberry.input(description="Render a text template over the inputs.")
class TextStateInput:
    template: str
    template_format: DecisionTemplateFormat

    def to_orm(self) -> TextState:
        return TextState(
            type="text", template=self.template, template_format=self.template_format.value
        )


@strawberry.input(
    one_of=True,
    description=(
        "How the state sent to the model is built from the inputs. Exactly one must be set: "
        "`object: true` sends the inputs object itself, `text` renders a template, and "
        "`input` sends one input's value unchanged."
    ),
)
class DecisionStateInput:
    object: Optional[bool] = UNSET
    text: Optional[TextStateInput] = UNSET
    input: Optional[str] = strawberry.field(
        default=UNSET, description="The name of the input whose value is the state."
    )

    def to_orm(self) -> DecisionState:
        if self.object is not UNSET:
            return ObjectState(type="object")
        if self.text:
            return self.text.to_orm()
        if self.input is not UNSET and self.input is not None:
            return InputState(type="input", name=self.input)
        raise ValueError("DecisionStateInput: no field is set")
