"""A decision version's inputs, state, and questions, as stored in its JSON columns.

These types describe structure only: what a stored row must look like to be read at
all. Every rule here also runs on every read, so limits and content checks that might
change (option counts, uniqueness, blank text) are write-time policy and live with the
code that accepts new versions, not here. Tightening a rule must never make an old row
unreadable.

The vocabulary is Phoenix's own. Provider adapters translate it; nothing here follows a
provider's wire format.
"""

from typing import Annotated, Any, Literal, Optional, Union

from pydantic import Field, RootModel

from phoenix.db.types.db_helper_types import DBBaseModel


class DecisionInput(DBBaseModel):
    """One named input a caller passes: the decision's signature."""

    name: str
    description: Optional[str] = None
    json_schema: Optional[dict[str, Any]] = None
    """Describes the value for the playground form. Not enforced when the decision runs."""


class ObjectState(DBBaseModel):
    """Send the inputs object itself as the state: exactly the declared inputs, as JSON."""

    type: Literal["object"]


class TextState(DBBaseModel):
    """Render a text template over the inputs. Structured inputs render as JSON."""

    type: Literal["text"]
    template: str
    template_format: Literal["MUSTACHE", "F_STRING"]


class InputState(DBBaseModel):
    """Send one input's value as the state, unchanged: text, a JSON object, or an array.

    For a caller, or a benchmark, that already has its whole state as one value.
    """

    type: Literal["input"]
    name: str


DecisionState = Annotated[Union[ObjectState, TextState, InputState], Field(discriminator="type")]


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


class DecisionQuestionsRootModel(RootModel[list[DecisionQuestion]]):
    """An ordered list of questions, for reading and writing the column."""

    root: list[DecisionQuestion]


class DecisionInputsRootModel(RootModel[list[DecisionInput]]):
    """An ordered list of inputs, for reading and writing the column."""

    root: list[DecisionInput]


class DecisionStateRootModel(RootModel[DecisionState]):
    """The state, for reading and writing the column."""

    root: DecisionState


QuestionFormat = Literal["phoenix", "system_one", "openai"]
"""How questions stored in a dataset example are written."""


class DecisionTaskConfig(DBBaseModel):
    """A decision run over a dataset, copied when the experiment is created.

    It mirrors a prompt task: a copy of the decision's definition, and where each
    example supplies what the definition needs. ``input_values_path`` works as a prompt
    task's ``template_variables_path`` and ``questions_path`` as its
    ``appended_messages_path``.
    """

    inputs: list[DecisionInput]
    state: DecisionState
    questions: list[DecisionQuestion]
    """The definition's questions. Empty when ``questions_path`` reads them per example."""
    input_values_path: str = "input"
    """A dot path into the example's context (``input``, ``reference``, ``metadata``) to
    the object holding the input values, by input name. Empty for the whole context."""
    questions_path: Optional[str] = None
    """A dot path into the example's input to that example's own questions, as a
    benchmark carries them, used instead of ``questions``."""
    questions_format: QuestionFormat = "system_one"
    custom_provider_name: Optional[str] = None
    """The custom provider the task runs on, by name when it was created. The task's
    ``custom_provider_id`` is cleared when the provider is deleted; this lets a resumed
    task fail by name instead of falling back to a built-in provider."""
