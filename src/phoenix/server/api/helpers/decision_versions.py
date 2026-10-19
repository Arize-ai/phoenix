"""Write-time rules for decision versions, and rendering a version's state.

The stored types in :mod:`phoenix.db.types.decisions` only describe structure, because
they are validated on every read. These rules apply when a version is accepted, by a
run or a save, and can change without making stored rows unreadable.
"""

import json
from typing import Any, Mapping, Sequence

from phoenix.db.types.decisions import (
    ChoiceQuestion,
    DecisionInput,
    DecisionQuestion,
    DecisionState,
    ObjectState,
    ScaleQuestion,
)
from phoenix.db.types.prompts import PromptTemplateFormat
from phoenix.utilities.template_formatters import TemplateFormatterError, get_template_formatter

# TypeSafe's documented limits (https://docs.typesafe.ai/api); OpenAI documents none. No
# provider documents a limit on the number of questions, so there is none here: request
# size and context length are the provider's to enforce.
MIN_CHOICES, MAX_CHOICES = 2, 255
MIN_LEVELS, MAX_LEVELS = 2, 10


def validate_questions(questions: Sequence[DecisionQuestion]) -> None:
    """Check questions being accepted for a run or a save.

    Raises:
        ValueError: The questions are empty, or a question breaks a rule; the message
            names the question.
    """
    if not questions:
        raise ValueError("At least one question is required")
    names: set[str] = set()
    for question in questions:
        name = question.name
        if not name.strip():
            raise ValueError("Question names cannot be empty")
        if name in names:
            raise ValueError(f"Question names must be unique: {name!r} is repeated")
        names.add(name)
        if not question.instructions.strip():
            raise ValueError(f"Instructions for {name} cannot be empty")
        if isinstance(question, ChoiceQuestion):
            values = [option.value for option in question.choices]
            if not MIN_CHOICES <= len(values) <= MAX_CHOICES:
                raise ValueError(f"{name} needs {MIN_CHOICES} to {MAX_CHOICES} choices")
            if any(not value.strip() for value in values):
                raise ValueError(f"Choice values for {name} cannot be empty")
            if len(set(values)) != len(values):
                raise ValueError(f"Choice values for {name} must be unique")
        elif isinstance(question, ScaleQuestion):
            if not MIN_LEVELS <= len(question.levels) <= MAX_LEVELS:
                raise ValueError(f"{name} needs {MIN_LEVELS} to {MAX_LEVELS} levels")
            if any(not level.label.strip() for level in question.levels):
                raise ValueError(f"Level labels for {name} cannot be empty")


def validate_inputs(inputs: Sequence[DecisionInput], state: DecisionState) -> None:
    """Check a version's inputs, and that its state only uses inputs it declares.

    Raises:
        ValueError: An input name is empty or repeated, or a text template is empty,
            invalid, or uses an undeclared input.
    """
    if not inputs:
        raise ValueError("At least one input is required")
    names: set[str] = set()
    for input in inputs:
        if not input.name.strip():
            raise ValueError("Input names cannot be empty")
        if input.name in names:
            raise ValueError(f"Input names must be unique: {input.name!r} is repeated")
        names.add(input.name)
    if isinstance(state, ObjectState):
        return
    if not state.template.strip():
        raise ValueError("The state template cannot be empty")
    formatter = get_template_formatter(PromptTemplateFormat(state.template_format))
    try:
        variables = formatter.parse(state.template)
    except TemplateFormatterError as error:
        raise ValueError(f"The state template is invalid: {error}") from error
    if undeclared := sorted(variables - names):
        raise ValueError(f"The state template uses undeclared inputs: {', '.join(undeclared)}")


def render_state(
    inputs: Sequence[DecisionInput], state: DecisionState, values: Mapping[str, Any]
) -> Any:
    """Build the state sent to the model from a call's input values.

    An ``object`` state is exactly the declared inputs. A ``text`` state renders its
    template; a structured value renders as JSON when named on its own, while Mustache
    dotted paths and sections still read into it.

    Raises:
        ValueError: A declared input is missing, or an undeclared one is passed.
    """
    names = [input.name for input in inputs]
    if missing := [name for name in names if name not in values]:
        raise ValueError(f"Missing inputs: {', '.join(missing)}")
    if undeclared := sorted(set(values) - set(names)):
        raise ValueError(f"Undeclared inputs: {', '.join(undeclared)}")
    if isinstance(state, ObjectState):
        return {name: values[name] for name in names}
    formatter = get_template_formatter(PromptTemplateFormat(state.template_format))
    try:
        return formatter.format(
            state.template, **{name: _rendered_as_json(values[name]) for name in names}
        )
    except TemplateFormatterError as error:
        raise ValueError(str(error)) from error


class _JSONDict(dict[str, Any]):
    def __str__(self) -> str:
        return json.dumps(self, default=_unwrap, ensure_ascii=False)


class _JSONList(list[Any]):
    def __str__(self) -> str:
        return json.dumps(self, default=_unwrap, ensure_ascii=False)


class _JSONScalar:
    """A boolean or null that renders as JSON but keeps its truthiness for sections."""

    def __init__(self, value: Any) -> None:
        self.value = value

    def __str__(self) -> str:
        return json.dumps(self.value)

    def __bool__(self) -> bool:
        return bool(self.value)


def _unwrap(value: Any) -> Any:
    if isinstance(value, _JSONScalar):
        return value.value
    raise TypeError(f"{type(value).__name__} is not JSON serializable")


def _rendered_as_json(value: Any) -> Any:
    """Wrap ``value`` so a template renders it as JSON, not as a Python repr."""
    if isinstance(value, dict):
        return _JSONDict({key: _rendered_as_json(item) for key, item in value.items()})
    if isinstance(value, list):
        return _JSONList(_rendered_as_json(item) for item in value)
    if isinstance(value, bool) or value is None:
        return _JSONScalar(value)
    return value
