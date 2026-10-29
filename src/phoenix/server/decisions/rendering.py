"""Render a decision's state and questions from a call's variables.

A saved decision is the request it sends, with holes in it. Its variables are the root
names of the variable tags in its state template and its templated question fields, in
first-appearance order, under the version's template format. Rendering fills them:

1. A variable of the decision missing from ``variables`` is an error naming it; extra
   variables are ignored.
2. A text template renders with the template format. A structured value renders as JSON,
   and Mustache dotted paths and sections read into structured values.
3. A JSON template is walked; object keys are literal. A string leaf that is exactly one
   variable tag (Mustache ``{{ path }}``, F-String ``{path}``) becomes the value it names,
   JSON type kept, and reading a missing field is an error. Any other string leaf renders
   by rule 2. Numbers, booleans and null pass through.
4. ``NONE`` substitutes nothing.
5. The state must come out as non-empty text, an object, or a list.
6. Each templated question field renders by rule 2; instructions cannot render empty.

The vectors in ``tests/fixtures/decisions/rendering_cases.json`` pin them, as data a client
that renders decisions itself can run too.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from string import Formatter
from typing import Any, Iterator, Mapping, Optional, Sequence, TypeVar, Union

import pystache
from pydantic import BaseModel
from pystache.parser import (  # type: ignore[import-untyped]
    ParsingError,
    _EscapeNode,
    _InvertedNode,
    _LiteralNode,
    _SectionNode,
)
from typing_extensions import assert_never

from phoenix.db.types.decisions import (
    ChoiceQuestion,
    DecisionQuestion,
    DecisionState,
    JsonState,
    PredicateQuestion,
    ScaleQuestion,
    TextState,
)
from phoenix.db.types.prompts import PromptTemplateFormat

RenderedState = Union[str, dict[str, Any], list[Any]]
_Model = TypeVar("_Model", bound=BaseModel)


@dataclass(frozen=True)
class RenderedDecision:
    """What a call sends: the rendered state and questions, in the questions' order."""

    state: RenderedState
    questions: list[DecisionQuestion]


def decision_variables(
    template_format: PromptTemplateFormat,
    state: DecisionState,
    questions: Sequence[DecisionQuestion],
) -> list[str]:
    """The variables a decision's templates use, by root name, in first-appearance order.

    The state comes first, then each question's fields in order. A dotted path such as
    ``{{customer.tier}}`` names ``customer``. Names inside a Mustache section are read
    from the section's value, so only the section's own name is a variable.

    Raises:
        ValueError: A template can't be parsed; the message says which.
    """
    names: dict[str, None] = {}
    for location, template in _templates(state, questions):
        for name in _template_variables(template_format, template, location):
            names.setdefault(name, None)
    return list(names)


def render_decision(
    template_format: PromptTemplateFormat,
    state: DecisionState,
    questions: Sequence[DecisionQuestion],
    variables: Mapping[str, Any],
) -> RenderedDecision:
    """Fill a decision's templates with a call's variables.

    Raises:
        ValueError: A template is invalid, a variable is missing, a whole-tag path reads a
            missing field, or the state or an instruction renders to something a provider
            won't take. The message says which.
    """
    names = decision_variables(template_format, state, questions)
    if missing := [name for name in names if name not in variables]:
        raise ValueError(f"Missing variables: {', '.join(missing)}")
    values = dict(variables)
    rendered_state: Any
    if isinstance(state, TextState):
        rendered_state = _render_text(template_format, state.template, values, "the state")
    elif isinstance(state, JsonState):
        rendered_state = _render_json(template_format, state.template, values)
    else:
        assert_never(state)
    if not isinstance(rendered_state, (str, dict, list)):
        raise ValueError("State must be text, a JSON object, or a list")
    if isinstance(rendered_state, str) and not rendered_state.strip():
        raise ValueError("State cannot be empty")
    return RenderedDecision(
        state=rendered_state,
        questions=[_render_question(template_format, question, values) for question in questions],
    )


def _templates(
    state: DecisionState, questions: Sequence[DecisionQuestion]
) -> Iterator[tuple[str, str]]:
    """Every template of a decision, with where it is for error messages."""
    if isinstance(state, TextState):
        yield "the state", state.template
    elif isinstance(state, JsonState):
        for leaf in _string_leaves(state.template):
            yield "the state", leaf
    else:
        assert_never(state)
    for question in questions:
        for location, text in _question_fields(question):
            if text is not None:
                yield location, text


def _question_fields(question: DecisionQuestion) -> Iterator[tuple[str, Optional[str]]]:
    yield f"the instructions of {question.name}", question.instructions
    if isinstance(question, PredicateQuestion):
        if question.criteria is not None:
            yield f"the true criterion of {question.name}", question.criteria.true
            yield f"the false criterion of {question.name}", question.criteria.false
    elif isinstance(question, ChoiceQuestion):
        for option in question.choices:
            yield f"choice {option.value!r} of {question.name}", option.description
    elif isinstance(question, ScaleQuestion):
        for level in question.levels:
            yield f"level {level.label!r} of {question.name}", level.description
    else:
        assert_never(question)


def _string_leaves(value: Any) -> Iterator[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _string_leaves(item)
    elif isinstance(value, list):
        for item in value:
            yield from _string_leaves(item)


def _template_variables(
    template_format: PromptTemplateFormat, template: str, location: str
) -> list[str]:
    """Root variable names in one template, in order of appearance."""
    if template_format is PromptTemplateFormat.NONE:
        return []
    names: list[str] = []
    if template_format is PromptTemplateFormat.MUSTACHE:
        try:
            parsed = pystache.parse(template, raise_on_mismatch=True)
        except ParsingError as error:
            raise ValueError(f"Invalid template in {location}: {error}") from error
        for node in parsed._parse_tree:
            if not isinstance(node, (_SectionNode, _InvertedNode, _EscapeNode, _LiteralNode)):
                continue
            key = getattr(node, "key", None)
            if isinstance(key, str) and key and key != ".":
                names.append(key.split(".")[0])
        return names
    if template_format is PromptTemplateFormat.F_STRING:
        try:
            fields = [field for _, field, _, _ in Formatter().parse(template) if field]
        except ValueError as error:
            raise ValueError(f"Invalid template in {location}: {error}") from error
        for field in fields:
            match = re.match(r"^[^.\[]+", field)
            names.append(match.group(0) if match else field)
        return names
    assert_never(template_format)


_MUSTACHE_WHOLE_TAG = re.compile(r"\{\{\s*([^\s{}#^/!>&=.][^\s{}]*)\s*\}\}")
_F_STRING_WHOLE_TAG = re.compile(r"\{([^{}!:]+)\}")


def _render_json(template_format: PromptTemplateFormat, value: Any, values: dict[str, Any]) -> Any:
    if template_format is PromptTemplateFormat.NONE:
        return value
    if isinstance(value, dict):
        return {key: _render_json(template_format, item, values) for key, item in value.items()}
    if isinstance(value, list):
        return [_render_json(template_format, item, values) for item in value]
    if isinstance(value, str):
        pattern = (
            _MUSTACHE_WHOLE_TAG
            if template_format is PromptTemplateFormat.MUSTACHE
            else _F_STRING_WHOLE_TAG
        )
        if match := pattern.fullmatch(value):
            return _resolve(template_format, match.group(1), values)
        return _render_text(template_format, value, values, "the state")
    return value


def _resolve(template_format: PromptTemplateFormat, path: str, values: dict[str, Any]) -> Any:
    """The value a whole-tag path names, as it is: object, list, string, number, bool, null."""
    if template_format is PromptTemplateFormat.F_STRING:
        try:
            value, _ = _F_STRING_FORMATTER.get_field(path, (), values)
        except (AttributeError, KeyError, IndexError, TypeError) as error:
            raise ValueError(f"The state reads a missing field: {path}") from error
        return value
    root, *parts = path.split(".")
    value = values[root]
    # Mustache paths walk object fields only, as the text renderer does.
    for part in parts:
        if not isinstance(value, dict) or part not in value:
            raise ValueError(f"The state reads a missing field: {path}")
        value = value[part]
    return value


def _render_text(
    template_format: PromptTemplateFormat, template: str, values: dict[str, Any], location: str
) -> str:
    if template_format is PromptTemplateFormat.NONE:
        return template
    try:
        # A null value renders as `null` under Mustache too: structured values are JSON.
        if template_format is PromptTemplateFormat.F_STRING:
            return _F_STRING_FORMATTER.vformat(template, (), values)
        return str(_MUSTACHE_RENDERER.render(template, values))
    except ParsingError as error:
        raise ValueError(f"Invalid template in {location}: {error}") from error
    except (AttributeError, KeyError, IndexError, TypeError, ValueError) as error:
        # F-string paths raise these from Formatter.vformat; Mustache renders a miss as empty.
        detail = error.args[0] if error.args else type(error).__name__
        raise ValueError(f"Can't render {location}: {detail}") from error


def _render_question(
    template_format: PromptTemplateFormat, question: DecisionQuestion, values: dict[str, Any]
) -> DecisionQuestion:
    def render(model: _Model, field: str, location: str) -> _Model:
        # Only fields with text are touched, so the copy dumps like the original.
        text = getattr(model, field)
        if text is None:
            return model
        return model.model_copy(
            update={field: _render_text(template_format, text, values, location)}
        )

    rendered = render(question, "instructions", f"the instructions of {question.name}")
    if not rendered.instructions.strip():
        raise ValueError(f"Instructions for {question.name} cannot be empty")
    if isinstance(rendered, PredicateQuestion):
        if (criteria := rendered.criteria) is not None:
            criteria = render(criteria, "true", f"the true criterion of {question.name}")
            criteria = render(criteria, "false", f"the false criterion of {question.name}")
            rendered = rendered.model_copy(update={"criteria": criteria})
    elif isinstance(rendered, ChoiceQuestion):
        choices = [
            render(option, "description", f"choice {option.value!r} of {question.name}")
            for option in rendered.choices
        ]
        rendered = rendered.model_copy(update={"choices": choices})
    elif isinstance(rendered, ScaleQuestion):
        levels = [
            render(level, "description", f"level {level.label!r} of {question.name}")
            for level in rendered.levels
        ]
        rendered = rendered.model_copy(update={"levels": levels})
    else:
        assert_never(rendered)
    return rendered


_FIELD_PART_RE = re.compile(r"\.([^.\[\]]+)|\[([^\[\]]+)\]")


class _JSONMustacheRenderer(pystache.Renderer):  # type: ignore[misc]
    def __init__(self) -> None:
        super().__init__(escape=lambda x: x)

    def str_coerce(self, val: Any) -> str:
        return json.dumps(val, ensure_ascii=False)


class _JSONFStringFormatter(Formatter):
    """Traverse only JSON object fields and array items, rendering non-strings as JSON."""

    def get_field(
        self, field_name: str, args: Sequence[Any], kwargs: Mapping[str, Any]
    ) -> tuple[Any, str]:
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
