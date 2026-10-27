"""Render a decision version's state from a call's input values."""

from __future__ import annotations

import json
import re
from string import Formatter
from typing import Any, Mapping, Sequence

import pystache

from phoenix.db.types.decisions import (
    DecisionInput,
    DecisionState,
    InputState,
    ObjectState,
)
from phoenix.db.types.prompts import PromptTemplateFormat


def render_state(
    inputs: Sequence[DecisionInput], state: DecisionState, values: Mapping[str, Any]
) -> str | dict[str, Any] | list[Any]:
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
        result: object = {name: values[name] for name in names}
    elif isinstance(state, InputState):
        result = values[state.name]
    else:
        template_format = PromptTemplateFormat(state.template_format)
        bound = {name: values[name] for name in names}
        try:
            # A null input renders as `null` under Mustache too: structured inputs are JSON.
            if template_format is PromptTemplateFormat.F_STRING:
                result = _F_STRING_FORMATTER.vformat(state.template, (), bound)
            else:
                result = str(_MUSTACHE_RENDERER.render(state.template, bound))
        except (AttributeError, KeyError, IndexError, TypeError) as error:
            # F-string paths raise these from Formatter.vformat; Mustache renders a miss as empty.
            detail = error.args[0] if error.args else type(error).__name__
            raise ValueError(
                f"The state template can't be rendered from these inputs: {detail}"
            ) from error
    if not isinstance(result, (str, dict, list)):
        raise ValueError("State must be text, a JSON object, or a list")
    if isinstance(result, str) and not result.strip():
        raise ValueError("State cannot be empty")
    return result


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
