"""REST schemas for saved decisions, their versions, and version tags.

The response models describe structure only, as the stored types in
:mod:`phoenix.db.types.decisions` do, so tightening a write-time rule never makes a stored
version unreadable. The write-time rules (question limits, template parsing, providers that
offer decision models) run in :meth:`DecisionVersionData.to_orm`, when a version is accepted.
"""

from typing import Annotated, Any, Literal, Optional, Union

from pydantic import Field, field_validator
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.types.db_helper_types import UNDEFINED
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
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import PromptTemplateFormat
from phoenix.server.api.routers.v1.models import IsoDatetime, V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import HexColor
from phoenix.server.api.types.node import from_global_id_with_expected_type


class DecisionTextState(V1RoutesBaseModel):
    """The state is text: a template rendered with the version's template format."""

    type: Literal["text"]
    template: str


class DecisionJsonState(V1RoutesBaseModel):
    """The state is JSON: any JSON value whose string leaves are templates.

    A string leaf that is exactly one variable tag is replaced by the variable's value with its
    JSON type kept; any other string leaf renders as text. Object keys are literal.
    """

    type: Literal["json"]
    template: Any = Field(
        description="An object, a list, or a string whose string leaves are templates."
    )


DecisionStateData = Annotated[
    Union[DecisionTextState, DecisionJsonState], Field(discriminator="type")
]


class DecisionPredicateCriteria(V1RoutesBaseModel):
    """What counts as true and as false; either may be omitted."""

    true: Optional[str] = None
    false: Optional[str] = None


class DecisionPredicateQuestion(V1RoutesBaseModel):
    """A statement or yes/no question, answered with the probability that it is true."""

    type: Literal["predicate"]
    name: str = Field(description="The name the answer is returned under.")
    instructions: str
    criteria: Optional[DecisionPredicateCriteria] = None


class DecisionChoiceOption(V1RoutesBaseModel):
    value: str
    description: Optional[str] = None


class DecisionChoiceQuestion(V1RoutesBaseModel):
    """One option from a fixed set of 2–255."""

    type: Literal["choice"]
    name: str = Field(description="The name the answer is returned under.")
    instructions: str
    choices: list[DecisionChoiceOption]


class DecisionScaleLevel(V1RoutesBaseModel):
    label: str
    description: Optional[str] = None


class DecisionScaleQuestion(V1RoutesBaseModel):
    """2–10 ordered levels; a level's position, from zero, is its value."""

    type: Literal["scale"]
    name: str = Field(description="The name the answer is returned under.")
    instructions: str
    levels: list[DecisionScaleLevel]


DecisionQuestionData = Annotated[
    Union[DecisionPredicateQuestion, DecisionChoiceQuestion, DecisionScaleQuestion],
    Field(discriminator="type"),
]


def _state_to_db(state: Union[DecisionTextState, DecisionJsonState]) -> DecisionState:
    if isinstance(state, DecisionTextState):
        return TextState(type="text", template=state.template)
    if isinstance(state, DecisionJsonState):
        return JsonState(type="json", template=state.template)
    assert_never(state)


def _state_from_db(state: DecisionState) -> Union[DecisionTextState, DecisionJsonState]:
    if isinstance(state, TextState):
        return DecisionTextState(type="text", template=state.template)
    if isinstance(state, JsonState):
        return DecisionJsonState(type="json", template=state.template)
    assert_never(state)


def _question_to_db(
    question: Union[DecisionPredicateQuestion, DecisionChoiceQuestion, DecisionScaleQuestion],
) -> DecisionQuestion:
    if isinstance(question, DecisionPredicateQuestion):
        criteria = question.criteria
        return PredicateQuestion(
            type="predicate",
            name=question.name,
            instructions=question.instructions,
            criteria=PredicateCriteria(true=criteria.true, false=criteria.false)
            if criteria is not None
            else None,
        )
    if isinstance(question, DecisionChoiceQuestion):
        return ChoiceQuestion(
            type="choice",
            name=question.name,
            instructions=question.instructions,
            choices=[
                ChoiceOption(value=option.value, description=option.description)
                for option in question.choices
            ],
        )
    if isinstance(question, DecisionScaleQuestion):
        return ScaleQuestion(
            type="scale",
            name=question.name,
            instructions=question.instructions,
            levels=[
                ScaleLevel(label=level.label, description=level.description)
                for level in question.levels
            ],
        )
    assert_never(question)


def _question_from_db(
    question: DecisionQuestion,
) -> Union[DecisionPredicateQuestion, DecisionChoiceQuestion, DecisionScaleQuestion]:
    if isinstance(question, PredicateQuestion):
        criteria = question.criteria
        return DecisionPredicateQuestion(
            type="predicate",
            name=question.name,
            instructions=question.instructions,
            criteria=DecisionPredicateCriteria(true=criteria.true, false=criteria.false)
            if criteria is not None
            else None,
        )
    if isinstance(question, ChoiceQuestion):
        return DecisionChoiceQuestion(
            type="choice",
            name=question.name,
            instructions=question.instructions,
            choices=[
                DecisionChoiceOption(value=option.value, description=option.description)
                for option in question.choices
            ],
        )
    if isinstance(question, ScaleQuestion):
        return DecisionScaleQuestion(
            type="scale",
            name=question.name,
            instructions=question.instructions,
            levels=[
                DecisionScaleLevel(label=level.label, description=level.description)
                for level in question.levels
            ],
        )
    assert_never(question)


def encode_decision_id(decision_id: int) -> str:
    return str(GlobalID("Decision", str(decision_id)))


def encode_decision_version_id(decision_version_id: int) -> str:
    return str(GlobalID("DecisionVersion", str(decision_version_id)))


def encode_custom_provider_id(custom_provider_id: int) -> str:
    return str(GlobalID("GenerativeModelCustomProvider", str(custom_provider_id)))


def encode_decision_label_id(decision_label_id: int) -> str:
    return str(GlobalID("DecisionLabel", str(decision_label_id)))


def encode_decision_version_tag_id(decision_version_tag_id: int) -> str:
    return str(GlobalID("DecisionVersionTag", str(decision_version_tag_id)))


class Decision(V1RoutesBaseModel):
    """A saved decision: a named, versioned typed function that apps fetch by tag."""

    id: str = Field(description="The GlobalID of the decision.")
    name: Identifier
    description: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    source_decision_id: Optional[str] = Field(
        default=None,
        description="The GlobalID of the decision this one was cloned from, if any.",
    )
    created_at: IsoDatetime
    updated_at: IsoDatetime

    @classmethod
    def from_orm_decision(cls, decision: models.Decision) -> "Decision":
        return cls(
            id=encode_decision_id(decision.id),
            name=decision.name,
            description=decision.description,
            metadata=decision.metadata_,
            source_decision_id=encode_decision_id(decision.source_decision_id)
            if decision.source_decision_id is not None
            else None,
            created_at=decision.created_at,
            updated_at=decision.updated_at,
        )


class DecisionData(V1RoutesBaseModel):
    """The decision to create, or to add a version to when one with this name exists.

    When the decision exists, an omitted description or metadata leaves it unchanged.
    """

    name: Identifier
    description: Optional[str] = Field(
        default=UNDEFINED,
        description="The decision's description. Omit to keep an existing decision's.",
    )
    metadata: dict[str, Any] = Field(
        default=UNDEFINED,
        description="The decision's metadata object. Omit to keep an existing decision's.",
    )


class DecisionVersionData(V1RoutesBaseModel):
    """A decision version to save: its template format, state template, questions, and the
    model that answers. Saved versions are immutable; saving again adds a version."""

    description: Optional[str] = None
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary JSON metadata for the decision version.",
    )
    template_format: PromptTemplateFormat = Field(
        description="How variable tags are read in the state and the question fields."
    )
    state: DecisionStateData
    questions: list[DecisionQuestionData] = Field(min_length=1)
    model_provider: ModelProvider = Field(
        description=(
            "The provider whose decision API answers; it must offer decision models. For a "
            "custom provider, the API its SDK speaks (e.g. OPENAI or TYPESAFE)."
        )
    )
    model_name: str
    custom_provider_id: Optional[str] = Field(
        default=None,
        description=(
            "GlobalID of a custom model provider for this version, or null for the built-in "
            "provider. The provider must serve decision models and speak model_provider's API."
        ),
    )

    @field_validator("custom_provider_id")
    @classmethod
    def _validate_custom_provider_id(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            from_global_id_with_expected_type(
                GlobalID.from_id(value), "GenerativeModelCustomProvider"
            )
        return value

    def to_orm(self, *, user_id: Optional[int]) -> models.DecisionVersion:
        """An unsaved version, checked against the write-time rules a run uses.

        The caller assigns the decision and checks the custom provider in its transaction.

        Raises:
            BadRequest: The provider offers no decision models, the model name is empty, or
                the state template or questions break a rule.
        """
        from phoenix.server.api.helpers.saved_decisions import new_decision_version

        return new_decision_version(
            template_format=self.template_format,
            state=_state_to_db(self.state),
            questions=[_question_to_db(question) for question in self.questions],
            model_provider=self.model_provider,
            model_name=self.model_name,
            custom_provider_id=from_global_id_with_expected_type(
                GlobalID.from_id(self.custom_provider_id), "GenerativeModelCustomProvider"
            )
            if self.custom_provider_id is not None
            else None,
            description=self.description,
            metadata=self.metadata,
            user_id=user_id,
        )


class DecisionVersion(V1RoutesBaseModel):
    """An immutable version of a decision."""

    id: str = Field(description="The GlobalID of the decision version.")
    decision_id: str = Field(description="The GlobalID of the decision this version belongs to.")
    description: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    template_format: PromptTemplateFormat
    state: DecisionStateData
    questions: list[DecisionQuestionData]
    variables: list[str] = Field(
        description=(
            "The variables the state and questions use, by root name, in first-appearance "
            "order. A call must supply each of them."
        )
    )
    model_provider: ModelProvider
    model_name: str
    custom_provider_id: Optional[str] = None
    created_at: IsoDatetime

    @classmethod
    def from_orm_decision_version(cls, version: models.DecisionVersion) -> "DecisionVersion":
        from phoenix.server.decisions.rendering import decision_variables

        return cls(
            id=encode_decision_version_id(version.id),
            decision_id=encode_decision_id(version.decision_id),
            description=version.description,
            metadata=version.metadata_,
            template_format=PromptTemplateFormat(version.template_format),
            state=_state_from_db(version.state),
            questions=[_question_from_db(question) for question in version.questions],
            variables=decision_variables(version.template_format, version.state, version.questions),
            model_provider=version.model_provider,
            model_name=version.model_name,
            custom_provider_id=encode_custom_provider_id(version.custom_provider_id)
            if version.custom_provider_id is not None
            else None,
            created_at=version.created_at,
        )


class DecisionVersionTagData(V1RoutesBaseModel):
    name: Identifier
    description: Optional[str] = Field(
        default=None,
        description="The tag's description. When moving an existing tag, null keeps its own.",
    )


class DecisionVersionTag(V1RoutesBaseModel):
    """A movable name for one of a decision's versions, such as ``production``."""

    id: str = Field(description="The GlobalID of the tag.")
    name: Identifier
    description: Optional[str] = None
    decision_version_id: str = Field(description="The GlobalID of the version the tag points to.")

    @classmethod
    def from_orm_decision_version_tag(cls, tag: models.DecisionVersionTag) -> "DecisionVersionTag":
        return cls(
            id=encode_decision_version_tag_id(tag.id),
            name=tag.name,
            description=tag.description,
            decision_version_id=encode_decision_version_id(tag.decision_version_id),
        )


class DecisionLabel(V1RoutesBaseModel):
    """A label for organizing decisions, such as ``support`` or ``billing``."""

    id: str = Field(description="The GlobalID of the decision label.")
    name: str
    description: Optional[str] = None
    color: Optional[str] = Field(
        default=None, description="A lowercase hex color code used to display the label."
    )

    @classmethod
    def from_orm_decision_label(cls, label: models.DecisionLabel) -> "DecisionLabel":
        return cls(
            id=encode_decision_label_id(label.id),
            name=label.name,
            description=label.description,
            color=label.color,
        )


class DecisionLabelData(V1RoutesBaseModel):
    name: str = Field(min_length=1, description="The label's name, unique among decision labels.")
    color: HexColor = Field(
        description="A lowercase hex color code (e.g. '#00cc88') used to display the label."
    )
    description: Optional[str] = None
