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


DecisionState = Annotated[Union[ObjectState, TextState], Field(discriminator="type")]


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
