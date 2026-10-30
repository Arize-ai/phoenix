from typing import TYPE_CHECKING, Optional, Sequence

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.db.types.decisions import (
    ChoiceOption,
    ChoiceQuestion,
    DecisionQuestion,
    DecisionState,
    JsonState,
    PredicateCriteria,
    PredicateQuestion,
    ScaleLevel,
    ScaleQuestion,
    TextState,
)
from phoenix.db.types.prompts import PromptTemplateFormat
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


@strawberry.input(
    one_of=True,
    description=(
        "The state template. Exactly one must be set: `text` is a text template; `json` is "
        "any JSON value whose string leaves are templates, where a string that is exactly one "
        "variable tag becomes the variable's value with its JSON type kept."
    ),
)
class DecisionStateInput:
    text: Optional[str] = UNSET
    json: Optional[JSON] = UNSET

    def to_orm(self) -> DecisionState:
        if self.text is not UNSET and self.text is not None:
            return TextState(type="text", template=self.text)
        if self.json is not UNSET:
            return JsonState(type="json", template=self.json)
        raise ValueError("DecisionStateInput: no field is set")


def to_decision_definition(
    template_format: PromptTemplateFormat,
    state: DecisionStateInput,
    questions: Sequence[DecisionQuestionInput],
) -> tuple[DecisionState, list[DecisionQuestion]]:
    """The stored state and questions, checked against the write-time rules.

    Raises:
        ValueError: The state template or the questions break a rule.
    """
    from phoenix.server.decisions.validation import validate_questions, validate_template

    stored_state = state.to_orm()
    stored_questions = [question.to_orm() for question in questions]
    validate_template(template_format, stored_state, stored_questions)
    validate_questions(stored_questions)
    return stored_state, stored_questions


@strawberry.input(
    description="A decision version to save: its template format, state template, questions, "
    "and the model that answers. Saved versions are immutable; saving again adds a version."
)
class DecisionVersionInput:
    template_format: PromptTemplateFormat = strawberry.field(
        description="How variable tags are read in the state and the question fields."
    )
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
            BadRequest: The state template or questions break a rule, the model name is
                empty, or the provider offers no decision models.
        """
        from phoenix.db import models
        from phoenix.server.api.helpers.decision_clients import DECISION_CLIENTS
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
            state, questions = to_decision_definition(
                self.template_format, self.state, self.questions
            )
            custom_provider_id = (
                from_global_id_with_expected_type(
                    self.custom_provider_id, GenerativeModelCustomProvider.__name__
                )
                if self.custom_provider_id is not None
                else None
            )
        except ValueError as error:
            raise BadRequest(str(error)) from error
        return models.DecisionVersion(
            description=self.description,
            user_id=user_id,
            template_format=self.template_format,
            state=state,
            questions=questions,
            model_provider=self.model_provider.to_model_provider(),
            model_name=self.model_name.strip(),
            custom_provider_id=custom_provider_id,
            metadata_=dict(self.metadata or {}),
        )
