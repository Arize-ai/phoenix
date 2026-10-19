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
from phoenix.db.types.evaluators import InputMapping, JSONPath

DECISION_SCHEMA_VERSION = 1
"""The shape of the types below. Bump it when their meaning changes."""


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


class FixedQuestions(DBBaseModel):
    """The same questions for every example, as a saved decision asks them."""

    type: Literal["fixed"]
    questions: list[DecisionQuestion]


class ExampleQuestions(DBBaseModel):
    """Each example carries its own questions, as a published benchmark does."""

    type: Literal["example"]
    path: JSONPath
    """Where the questions are in the example's evaluation context."""
    format: QuestionFormat


DecisionQuestionSource = Annotated[
    Union[FixedQuestions, ExampleQuestions], Field(discriminator="type")
]


class DecisionReferences(DBBaseModel):
    """Where each question's reference answer is in an example, and who wrote it.

    A path is a template over the example's evaluation context: ``{question}`` stands
    for a question's name, so one template serves questions that vary per example. A
    reference that is missing or unreadable is skipped and counted, never scored.
    """

    label_path: Optional[str] = None
    """The expected answer: a choice value, true or false, or a level."""
    distribution_path: Optional[str] = None
    """A reference distribution over the answers, such as a teacher model's."""
    annotator_kind: Literal["HUMAN", "LLM", "CODE"]
    """Accuracy against human references; agreement against a model's."""


class DecisionScoring(DBBaseModel):
    """Settings that change scores without changing what the model was asked."""

    predicate_threshold: float = 0.5
    """A predicate counts as true at or above this probability."""


class DecisionTaskConfig(DBBaseModel):
    """A decision experiment: how each example becomes a request, and how it is scored.

    The state is built from example values exactly as a saved decision's is, through
    ``input_mapping``, so a benchmark's state is one input mapped to its path.
    """

    schema_version: int = DECISION_SCHEMA_VERSION
    inputs: list[DecisionInput]
    state: DecisionState
    input_mapping: InputMapping
    questions: DecisionQuestionSource
    references: Optional[DecisionReferences] = None
    scoring: DecisionScoring = Field(default_factory=DecisionScoring)
