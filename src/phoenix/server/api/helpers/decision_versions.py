"""Write-time rules for decision versions, and rendering a version's state.

The stored types in :mod:`phoenix.db.types.decisions` only describe structure, because
they are validated on every read. These rules apply when a version is accepted, by a
run or a save, and can change without making stored rows unreadable.
"""

import json
from typing import Any, Mapping, Sequence

from pydantic import ValidationError

from phoenix.db.types.decisions import (
    ChoiceQuestion,
    DecisionInput,
    DecisionQuestion,
    DecisionState,
    InputState,
    ObjectState,
    ScaleQuestion,
)
from phoenix.db.types.prompts import PromptTemplateFormat
from phoenix.utilities.template_formatters import TemplateFormatterError, get_template_formatter

# Both providers document 2 to 255 choices (TypeSafe at https://docs.typesafe.ai/api,
# OpenAI in its SDK's request types). The 2 to 10 levels are TypeSafe's; OpenAI documents
# no level limit. Neither documents a limit on the number of questions, so there is none
# here: request size and context length are the provider's to enforce.
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
    if isinstance(state, InputState):
        if state.name not in names:
            raise ValueError(f"The state uses an undeclared input: {state.name}")
        return
    if not state.template.strip():
        raise ValueError("The state template cannot be empty")
    formatter = get_template_formatter(PromptTemplateFormat(state.template_format))
    try:
        # Root names only: a dotted path such as {ticket.subject} names the input ticket.
        variables = formatter.parse_with_types(state.template).names()
    except TemplateFormatterError as error:
        raise ValueError(f"The state template is invalid: {error}") from error
    # TODO: Names inside a Mustache section (e.g. {{#ticket}}{{other}}{{/ticket}}) can
    # resolve against the section's own fields, so they are not checked here. They could
    # be once an input declares a json_schema.
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
        ValueError: A declared input is missing, or an undeclared one is passed, or a
            template path reads a field or item the input doesn't have.
    """
    names = [input.name for input in inputs]
    # Both are named together, so a misspelled name reads as the typo it is.
    problems: list[str] = []
    if missing := [name for name in names if name not in values]:
        problems.append(f"Missing inputs: {', '.join(missing)}")
    if undeclared := sorted(set(values) - set(names)):
        problems.append(f"Undeclared inputs: {', '.join(undeclared)}")
    if problems:
        raise ValueError("; ".join(problems))
    if isinstance(state, ObjectState):
        return {name: values[name] for name in names}
    if isinstance(state, InputState):
        return values[state.name]
    template_format = PromptTemplateFormat(state.template_format)
    formatter = get_template_formatter(template_format)
    wrap = _json_view if template_format is PromptTemplateFormat.F_STRING else _rendered_as_json
    try:
        # A null input renders as `null` under Mustache too: structured inputs are JSON.
        return formatter.format(state.template, **{name: wrap(values[name]) for name in names})
    except TemplateFormatterError as error:
        raise ValueError(str(error)) from error
    except (AttributeError, KeyError, IndexError, TypeError) as error:
        # F-string paths raise these from str.format_map; Mustache renders a miss as empty.
        detail = error.args[0] if error.args else type(error).__name__
        raise ValueError(
            f"The state template can't be rendered from these inputs: {detail}"
        ) from error


class _JSONDict(dict[str, Any]):
    def __str__(self) -> str:
        return json.dumps(self, default=_unwrap, ensure_ascii=False)


class _JSONList(list[Any]):
    def __getattribute__(self, name: str) -> Any:
        raise AttributeError(name)

    def __str__(self) -> str:
        return json.dumps(self, default=_unwrap, ensure_ascii=False)


class _JSONScalar:
    """A boolean or null that renders as JSON but keeps its truthiness for sections.

    It has no attributes: a Mustache section pushes it onto the context stack,
    so a name inside the section must fall through to the inputs.
    """

    __slots__ = ("__value",)

    def __init__(self, value: Any) -> None:
        self.__value = value

    def __getattribute__(self, name: str) -> Any:
        raise AttributeError(name)

    def __str__(self) -> str:
        return json.dumps(object.__getattribute__(self, "_JSONScalar__value"))

    def __bool__(self) -> bool:
        return bool(object.__getattribute__(self, "_JSONScalar__value"))


def _unwrap(value: Any) -> Any:
    if isinstance(value, _JSONScalar):
        return object.__getattribute__(value, "_JSONScalar__value")
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


class _JSONView:
    """A JSON value whose template paths expose only object fields and array items.

    Scalars stay wrapped until formatting so Python attributes and string indexing
    cannot turn an invalid JSON path into rendered text.
    """

    def __init__(self, data: Any) -> None:
        self._data = data

    def __getattr__(self, name: str) -> Any:
        if name.startswith("_") or not isinstance(self._data, dict) or name not in self._data:
            raise AttributeError(f"JSON value has no attribute {name!r}")
        return _json_view(self._data[name])

    def __getitem__(self, key: Any) -> Any:
        if not isinstance(self._data, (dict, list)):
            raise TypeError("JSON scalar is not subscriptable")
        if isinstance(self._data, dict):
            key = str(key)
        try:
            return _json_view(self._data[key])
        except (KeyError, IndexError, TypeError):
            raise KeyError(f"no item {key!r}") from None

    def __str__(self) -> str:
        if isinstance(self._data, str):
            return self._data
        return json.dumps(self._data, ensure_ascii=False)

    def __repr__(self) -> str:
        return repr(self._data) if isinstance(self._data, str) else str(self)

    def __format__(self, spec: str) -> str:
        if isinstance(self._data, (int, float)) and not isinstance(self._data, bool):
            return format(self._data, spec)
        return format(str(self), spec)


def _json_view(value: Any) -> Any:
    """Wrap every value so path traversal preserves JSON types until rendering."""
    return _JSONView(value)


_VALUE_ERROR_PREFIX = "Value error, "


def format_validation_error(error: ValidationError) -> str:
    """Pydantic's report as one readable line.

    Union branch tags (the question ``type`` discriminator, the ``state`` alternatives) are
    dropped from paths since callers never wrote them, custom-validator messages lose the
    ``Value error,`` boilerplate, and duplicate lines collapse.
    """
    messages: list[str] = []
    for item in error.errors(include_input=False):
        location = [str(part) for part in item["loc"]]
        if location and location[0] == "state":
            location = ["state"]
        elif len(location) >= 3 and location[0] == "questions":
            location = location[:2] + location[3:]
        message = str(item["msg"])
        if message.startswith(_VALUE_ERROR_PREFIX):
            message = message[len(_VALUE_ERROR_PREFIX) :]
        path = ".".join(location)
        line = f"{path}: {message}" if path else message
        if line not in messages:
            messages.append(line)
    return "; ".join(messages)
