from enum import Enum
from typing import TYPE_CHECKING, Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
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
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey

if TYPE_CHECKING:
    from phoenix.db import models


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
            if self.object is not True:
                raise ValueError("DecisionStateInput: object must be true")
            return ObjectState(type="object")
        if self.text:
            return self.text.to_orm()
        if self.input is not UNSET and self.input is not None:
            return InputState(type="input", name=self.input)
        raise ValueError("DecisionStateInput: no field is set")


@strawberry.input(
    description="A decision version to save: its inputs, state, questions, and the model that "
    "answers. Saved versions are immutable; saving again adds a version."
)
class DecisionVersionInput:
    inputs: list[DecisionInputDefinitionInput]
    state: DecisionStateInput
    questions: list[DecisionQuestionInput]
    model_provider: GenerativeProviderKey = strawberry.field(
        description="The provider whose decision API answers; it must offer decision models. "
        "For a custom provider, the API its SDK speaks (OPENAI or TYPESAFE)."
    )
    model_name: str
    custom_provider_id: Optional[GlobalID] = strawberry.field(
        default=None,
        description="Run on this custom provider instead of the built-in one.",
    )
    description: Optional[str] = None
    metadata: Optional[JSON] = None

    def to_orm(self, *, user_id: Optional[int]) -> "models.DecisionVersion":
        """An unsaved version, checked against the write-time rules a run uses.

        The caller assigns the decision and checks the custom provider in its transaction.

        Raises:
            BadRequest: The inputs, state, or questions break a rule, the model name is
                empty, or the provider offers no decision models.
        """
        from phoenix.db import models
        from phoenix.server.api.helpers.decision_clients import DECISION_CLIENTS
        from phoenix.server.api.helpers.decision_versions import (
            validate_inputs,
            validate_questions,
        )
        from phoenix.server.api.types.GenerativeModelCustomProvider import (
            GenerativeModelCustomProvider,
        )
        from phoenix.server.api.types.node import from_global_id_with_expected_type

        if self.model_provider not in DECISION_CLIENTS:
            raise BadRequest(f"{self.model_provider.value} does not offer decision models.")
        if not self.model_name.strip():
            raise BadRequest("A decision model name is required.")
        if self.metadata is not None and not isinstance(self.metadata, dict):
            raise BadRequest("metadata must be an object")
        try:
            inputs = [definition.to_orm() for definition in self.inputs]
            state = self.state.to_orm()
            questions = [question.to_orm() for question in self.questions]
            validate_inputs(inputs, state)
            validate_questions(questions)
        except ValueError as error:
            raise BadRequest(str(error)) from error
        return models.DecisionVersion(
            description=self.description,
            user_id=user_id,
            inputs=inputs,
            state=state,
            questions=questions,
            model_provider=self.model_provider.to_model_provider(),
            model_name=self.model_name.strip(),
            custom_provider_id=from_global_id_with_expected_type(
                self.custom_provider_id, GenerativeModelCustomProvider.__name__
            )
            if self.custom_provider_id is not None
            else None,
            metadata_=dict(self.metadata or {}),
        )
