"""Write-time rules for decision versions, and rendering a version's state.

The stored types in :mod:`phoenix.db.types.decisions` only describe structure, because
they are validated on every read. These rules apply when a version is accepted, by a
run or a save, and can change without making stored rows unreadable.
"""

import json
import re
from string import Formatter
from typing import TYPE_CHECKING, Any, Mapping, Sequence

import pystache
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

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from phoenix.db import models

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
    bound = {name: values[name] for name in names}
    try:
        # A null input renders as `null` under Mustache too: structured inputs are JSON.
        if template_format is PromptTemplateFormat.F_STRING:
            return _F_STRING_FORMATTER.vformat(state.template, (), bound)
        return str(_MUSTACHE_RENDERER.render(state.template, bound))
    except (AttributeError, KeyError, IndexError, TypeError) as error:
        # F-string paths raise these from Formatter.vformat; Mustache renders a miss as empty.
        detail = error.args[0] if error.args else type(error).__name__
        raise ValueError(
            f"The state template can't be rendered from these inputs: {detail}"
        ) from error


_FIELD_PART_RE = re.compile(r"\.([^.\[\]]+)|\[([^\[\]]+)\]")


class _JSONMustacheRenderer(pystache.Renderer):  # type: ignore[misc]
    def __init__(self) -> None:
        super().__init__(escape=lambda x: x)

    def str_coerce(self, val: Any) -> str:
        return json.dumps(val, ensure_ascii=False)


class _JSONFStringFormatter(Formatter):
    """Traverse only JSON object fields and array items, rendering non-strings as JSON."""

    def get_field(self, field_name: str, args: Sequence[Any], kwargs: Mapping[str, Any]) -> Any:
        first = re.match(r"^[^.\[\]]*", field_name).group(0)  # type: ignore[union-attr]
        obj = kwargs[first]
        for attr, index in _FIELD_PART_RE.findall(field_name[len(first) :]):
            if attr:
                if attr.startswith("_") or not isinstance(obj, dict) or attr not in obj:
                    raise AttributeError(f"JSON value has no attribute {attr!r}")
                obj = obj[attr]
            elif isinstance(obj, dict):
                if index not in obj:
                    raise KeyError(f"no item {index!r}")
                obj = obj[index]
            elif isinstance(obj, list):
                try:
                    obj = obj[int(index)]
                except (IndexError, ValueError):
                    key = int(index) if index.lstrip("-").isdigit() else index
                    raise KeyError(f"no item {key!r}") from None
            else:
                raise TypeError("JSON scalar is not subscriptable")
        return obj, first

    def convert_field(self, value: Any, conversion: str | None) -> Any:
        if conversion is None:
            return value
        if conversion == "r":
            return repr(value) if isinstance(value, str) else self.format_field(value, "")
        return super().convert_field(
            value if isinstance(value, str) else self.format_field(value, ""), conversion
        )

    def format_field(self, value: Any, format_spec: str) -> str:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return format(value, format_spec)
        text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
        return format(text, format_spec)


_MUSTACHE_RENDERER = _JSONMustacheRenderer()
_F_STRING_FORMATTER = _JSONFStringFormatter()


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


async def validate_decision_custom_provider(
    session: "AsyncSession", version: "models.DecisionVersion"
) -> None:
    """Reject a custom provider that is missing, serves no decision models, or speaks another
    API than the version's provider."""
    from strawberry.relay import GlobalID

    from phoenix.db import models
    from phoenix.db.types.model_provider import sdk_offers_decisions
    from phoenix.server.api.exceptions import BadRequest, NotFound
    from phoenix.server.api.types.GenerativeProvider import (
        CONFIG_TYPE_TO_GENERATIVE_PROVIDER_KEY,
        GenerativeProviderKey,
    )

    if (provider_id := version.custom_provider_id) is None:
        return
    provider = await session.get(models.GenerativeModelCustomProvider, provider_id)
    global_id = GlobalID("GenerativeModelCustomProvider", str(provider_id))
    if provider is None:
        raise NotFound(f"Custom provider not found: {global_id}")
    if not sdk_offers_decisions(provider.sdk):
        raise BadRequest(f"Custom provider '{provider.name}' does not serve decision models.")
    provider_key = CONFIG_TYPE_TO_GENERATIVE_PROVIDER_KEY[provider.sdk]
    version_key = GenerativeProviderKey.from_model_provider(version.model_provider)
    if provider_key is not version_key:
        raise BadRequest(
            f"Custom provider '{provider.name}' speaks the {provider_key.name} API, not "
            f"{version_key.name}."
        )
