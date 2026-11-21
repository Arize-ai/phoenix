"""A decision version's state and questions, as stored in its JSON columns.

These types describe structure only: what a stored row must look like to be read at
all. Every rule here also runs on every read, so limits and content checks that might
change (option counts, uniqueness, blank text) are write-time policy and live with the
code that accepts new versions, not here. Tightening a rule must never make an old row
unreadable.

A version's ``template_format`` covers its state and the prose fields of its questions
(instructions, predicate criteria, choice and level descriptions). Question names, choice
values and level labels are the identifiers answers are keyed on and are never templated.

The vocabulary is Phoenix's own. Provider adapters translate it; nothing here follows a
provider's wire format.
"""

from typing import Annotated, Any, Literal, Optional, Union

from pydantic import Field

from phoenix.db.types.db_helper_types import DBBaseModel
from phoenix.db.types.prompts import PromptTemplateFormat


class TextState(DBBaseModel):
    """The state is text: a template rendered with the version's template format."""

    type: Literal["text"]
    template: str


class JsonState(DBBaseModel):
    """The state is JSON: any JSON value whose string leaves are templates.

    A string leaf that is exactly one variable tag is replaced by the variable's value with
    its JSON type kept; any other string leaf renders as text. Object keys are literal.
    """

    type: Literal["json"]
    template: Any


DecisionState = Annotated[Union[TextState, JsonState], Field(discriminator="type")]


class PredicateCriteria(DBBaseModel):
    """What counts as true and as false; either may be left undescribed."""

    true: Optional[str] = None
    false: Optional[str] = None


class PredicateQuestion(DBBaseModel):
    """A statement or yes/no question, answered with the probability that it is true."""

    type: Literal["predicate"]
    name: str
    instructions: str
    criteria: Optional[PredicateCriteria] = None


class ChoiceOption(DBBaseModel):
    value: str
    description: Optional[str] = None


class ChoiceQuestion(DBBaseModel):
    """One option from a fixed set."""

    type: Literal["choice"]
    name: str
    instructions: str
    choices: list[ChoiceOption]


class ScaleLevel(DBBaseModel):
    label: str
    description: Optional[str] = None


class ScaleQuestion(DBBaseModel):
    """Ordered levels; a level's position, from zero, is its value."""

    type: Literal["scale"]
    name: str
    instructions: str
    levels: list[ScaleLevel]


DecisionQuestion = Annotated[
    Union[PredicateQuestion, ChoiceQuestion, ScaleQuestion], Field(discriminator="type")
]


class DecisionTaskConfig(DBBaseModel):
    """A decision run over a dataset, copied when the experiment is created.

    It mirrors a prompt task: a copy of the decision's definition, and where each
    example supplies the variables its templates use. The same questions are asked of
    every example.
    """

    template_format: PromptTemplateFormat
    """Covers the state and the templated question fields."""
    state: DecisionState
    questions: list[DecisionQuestion]
    """The fixed questions asked of every example."""
    template_variables_path: str = "input"
    """A dot path into the example's context (``input``, ``reference``, ``metadata``) to
    the object holding the variables, by name. Empty for the whole context."""
    custom_provider_name: Optional[str] = None
    """The custom provider the task runs on, by name when it was created. The task's
    ``custom_provider_id`` is cleared when the provider is deleted; this lets a resumed
    task fail by name instead of falling back to a built-in provider."""
