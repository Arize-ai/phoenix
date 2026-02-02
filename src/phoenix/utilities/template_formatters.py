import json
from abc import ABC, abstractmethod
from argparse import Namespace
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from string import Formatter
from typing import Any, Literal, cast

import pystache
from pystache.parser import (  # type: ignore[import-untyped]
    ParsingError,
    _EscapeNode,
    _InvertedNode,
    _LiteralNode,
    _SectionNode,
)
from typing_extensions import assert_never

from phoenix.server.api.helpers.prompts.models import PromptTemplateFormat


@dataclass(frozen=True)
class ParsedVariable:
    """Represents a parsed template variable with type information."""

    name: str
    variable_type: Literal["string", "section"]


@dataclass
class ParsedVariables:
    """Container for parsed variables with helper methods."""

    variables: frozenset[ParsedVariable]

    def names(self) -> set[str]:
        """Return just the variable names (for backward compatibility)."""
        return {v.name for v in self.variables}

    def section_variables(self) -> set[str]:
        """Return names of variables expecting structured data."""
        return {v.name for v in self.variables if v.variable_type == "section"}

    def string_variables(self) -> set[str]:
        """Return names of variables expecting string data."""
        return {v.name for v in self.variables if v.variable_type == "string"}


def _serialize_value(value: Any) -> str:
    """
    Serialize a value for string output in f-string templates.

    - Strings are returned as-is (no quotes)
    - Other types are JSON serialized
    """
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        return str(value)


class DotDict(Namespace):
    """
    A simple class that builds upon `argparse.Namespace`
    in order to make chained attributes possible.

    This allows f-string templates like `{reference.label}` to work with
    dict variables like `{"reference": {"label": "value"}}`.

    Examples:

    >>> dd = DotDict.from_dict({"user": {"name": "Alice"}})
    >>> dd.user.name
    'Alice'
    >>> dd["user"]["name"]
    'Alice'
    """

    def __init__(self) -> None:
        self._data: dict[str, Any] = {}

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, DotDict):
            return NotImplemented
        return vars(self) == vars(other)

    def __getattr__(self, name: str) -> Any:
        if name.startswith("_"):
            raise AttributeError(name)
        raise AttributeError(f"No attribute '{name}'")

    def __getitem__(self, key: Any) -> Any:
        value = self._data[key]
        return _wrap_value(value)

    def __repr__(self) -> str:
        item_keys = [k for k in self.__dict__ if not k.startswith("_")]

        if len(item_keys) == 0:
            return "DotDict()"
        elif len(item_keys) == 1:
            key = item_keys[0]
            val = self.__dict__[key]
            return f"DotDict({key}={val!r})"
        else:
            items = ", ".join(
                f"{key}={val!r}" for key, val in self.__dict__.items() if not key.startswith("_")
            )
            return f"DotDict({items})"

    def __str__(self) -> str:
        return _serialize_value(self._data)

    @classmethod
    def from_dict(cls, original: Mapping[str, Any]) -> "DotDict":
        """Create a DotDict from a (possibly nested) dict `original`.
        Warning: this method should not be used on very deeply nested inputs,
        since it's recursively traversing the nested dictionary values.
        """
        dd = DotDict()
        dd._data = dict(original)  # Store original data for bracket access and str()
        for key, value in original.items():
            if isinstance(value, Mapping):
                value = cls.from_dict(value)
            elif isinstance(value, list):
                value = ListWrapper(value)
            setattr(dd, key, value)
        return dd


class ListWrapper:
    """
    Wraps a list to support indexed access with recursive wrapping.

    This allows f-string templates like `{items[0].name}` to work with
    list variables containing dicts.
    """

    _data: list[Any]

    def __init__(self, data: list[Any]) -> None:
        self._data = data

    def __getitem__(self, key: Any) -> Any:
        value = self._data[key]
        return _wrap_value(value)

    def __repr__(self) -> str:
        return f"ListWrapper({self._data!r})"

    def __str__(self) -> str:
        return _serialize_value(self._data)


def _wrap_value(value: Any) -> Any:
    """Recursively wrap dicts and lists for attribute access."""
    if isinstance(value, dict):
        return DotDict.from_dict(value)
    if isinstance(value, list):
        return ListWrapper(value)
    return value


def _extract_root_variable(path: str) -> str:
    """
    Extract the root variable name from a path expression.

    Examples:
        - "reference.label" -> "reference"
        - "reference[label]" -> "reference"
        - "user.address.city" -> "user"
        - "items[0].name" -> "items"
        - "simple" -> "simple"
    """
    match = re.match(r"^([^.\[]+)", path)
    return match.group(1) if match else path


class TemplateFormatter(ABC):
    @abstractmethod
    def parse(self, template: str) -> set[str]:
        """
        Parse the template and return a set of variable names.
        """
        raise NotImplementedError

    def parse_with_types(self, template: str) -> ParsedVariables:
        """
        Parse the template and return variables with type information.

        Default implementation treats all variables as string type.
        Subclasses can override for richer type information.
        """
        names = self.parse(template)
        return ParsedVariables(
            variables=frozenset(ParsedVariable(name=name, variable_type="string") for name in names)
        )

    def format(self, template: str, **variables: Any) -> str:
        """
        Formats the template with the given variables.
        """
        template_variable_names = self.parse(template)
        # Extract root variable names from paths (e.g., "reference.label" -> "reference")
        required_root_variables = {_extract_root_variable(var) for var in template_variable_names}
        if missing_root_variables := required_root_variables - set(variables.keys()):
            raise TemplateFormatterError(
                f"Missing template variable(s): {', '.join(sorted(missing_root_variables))}"
            )
        return self._format(template, template_variable_names, **variables)

    @abstractmethod
    def _format(self, template: str, variable_names: Iterable[str], **variables: Any) -> str:
        raise NotImplementedError


class NoOpFormatter(TemplateFormatter):
    """
    No-op template formatter.

    Examples:

    >>> formatter = NoOpFormatter()
    >>> formatter.format("hello")
    'hello'
    """

    def parse(self, template: str) -> set[str]:
        return set()

    def _format(self, template: str, *args: Any, **variables: Any) -> str:
        return template


class FStringTemplateFormatter(TemplateFormatter):
    """
    Regular f-string template formatter.

    Supports path variables like `{reference.label}` with dict variables.
    Dicts are automatically wrapped to support attribute access.

    Supported syntax:
        - Dot notation for dict access: `{user.name}`, `{input.messages}`
        - Bracket notation for integer indices: `{items[0]}`, `{messages[0].content}`
        - Combinations: `{input.messages[0].content}`

    NOT supported (Python format string limitation):
        - Quoted string keys in brackets: `{user['name']}` or `{input["key"]}`
        - Python's format mini-language only allows unquoted identifiers or integers
          in brackets, not string literals

    Examples:

    >>> formatter = FStringTemplateFormatter()
    >>> formatter.format("{hello}", hello="world")
    'world'
    >>> formatter.format("{user.name}", user={"name": "Alice"})
    'Alice'
    >>> formatter.format("{items[0].value}", items=[{"value": "first"}])
    'first'
    """

    def parse(self, template: str) -> set[str]:
        return set(field_name for _, field_name, _, _ in Formatter().parse(template) if field_name)

    def _format(self, template: str, variable_names: Iterable[str], **variables: Any) -> str:
        # Wrap dict and list variables to support attribute access (e.g., {user.name})
        wrapped_variables = {key: _wrap_value(value) for key, value in variables.items()}
        return template.format(**wrapped_variables)


class MustacheTemplateFormatter(TemplateFormatter):
    """
    Mustache template formatter using pystache.

    Supports full Mustache syntax including sections ({{#list}}...{{/list}}),
    inverted sections ({{^field}}...{{/field}}), and nested properties.

    HTML escaping is disabled - values are rendered as-is.

    Uses a native-parser-first approach: relies on pystache.parse() for
    spec-consistent parsing. Invalid templates raise errors.

    Examples:

    >>> formatter = MustacheTemplateFormatter()
    >>> formatter.format("{{ hello }}", hello="world")
    'world'
    """

    def __init__(self) -> None:
        # Create renderer with no HTML escaping
        self._renderer = pystache.Renderer(escape=lambda x: x)

    @staticmethod
    def _get_root_variable_name(variable_path: str) -> str:
        """
        Extract the root variable name from a dotted path.

        Mustache uses dot notation to traverse nested properties (e.g., output.available_tools
        means context["output"]["available_tools"]). For validation purposes, we only need
        to check that the root variable exists.

        Examples:
            "output.available_tools" -> "output"
            "user.name" -> "user"
            "simple" -> "simple"
        """
        if variable_path == ".":
            return variable_path
        return variable_path.split(".")[0]

    @staticmethod
    def _extract_key(node: Any) -> str | None:
        key = getattr(node, "key", None)
        if not isinstance(key, str) or not key:
            return None
        return key

    def _extract_variables_from_parse_tree_with_types(
        self, parse_tree: list[Any]
    ) -> dict[str, Literal["string", "section"]]:
        """
        Extract top-level variable names with type info from a pystache parse tree.

        Section variables ({{#name}} or {{^name}}) are typed as "section".
        Regular variables are typed as "string", including:
          - Escaped variables: {{name}}
          - Unescaped triple-brace: {{{name}}}
          - Unescaped ampersand: {{& name}}
        """
        variables: dict[str, Literal["string", "section"]] = {}
        for node in parse_tree:
            if isinstance(node, (_SectionNode, _InvertedNode)):
                key = self._extract_key(node)
                if key:
                    root_name = self._get_root_variable_name(key)
                    variables[root_name] = "section"
                continue
            if isinstance(node, (_EscapeNode, _LiteralNode)):
                key = self._extract_key(node)
                if key:
                    root_name = self._get_root_variable_name(key)
                    variables.setdefault(root_name, "string")
        return variables

    def parse(self, template: str) -> set[str]:
        """
        Extract top-level variable names from mustache template.

        Delegates to parse_with_types() and returns just the variable names.
        See parse_with_types() for full documentation.
        """
        return self.parse_with_types(template).names()

    def parse_with_types(self, template: str) -> ParsedVariables:
        """
        Extract top-level variable names with type info from mustache template.

        Uses native parsing for spec-consistent extraction. Invalid templates
        raise TemplateFormatterError.

        Section variables ({{#name}} or {{^name}}) are typed as "section".
        Regular variables are typed as "string", including:
          - Escaped variables: {{name}}
          - Unescaped triple-brace: {{{name}}}
          - Unescaped ampersand: {{& name}}

        For dotted paths like {{output.available_tools}}, only the root variable
        name (output) is extracted, since Mustache traverses nested properties
        starting from the root.
        """
        try:
            parsed = pystache.parse(template, raise_on_mismatch=True)
        except ParsingError as exc:
            raise TemplateFormatterError(str(exc)) from exc

        parse_tree = getattr(parsed, "_parse_tree", None)
        if parse_tree is None:
            if isinstance(parsed, list):
                parse_tree = parsed
            else:
                raise TemplateFormatterError("Unable to access pystache parse tree.")
        if not isinstance(parse_tree, list):
            raise TemplateFormatterError("Unexpected pystache parse tree format.")

        variables = self._extract_variables_from_parse_tree_with_types(parse_tree)

        parsed = {
            ParsedVariable(name=name, variable_type=var_type)
            for name, var_type in variables.items()
        }
        return ParsedVariables(variables=frozenset(parsed))

    def _format(self, template: str, variable_names: Iterable[str], **variables: Any) -> str:
        # Render with pystache (no HTML escaping)
        result = self._renderer.render(template, variables)
        return cast(str, result)


class TemplateFormatterError(Exception):
    """
    An error raised when template formatting fails.
    """

    pass


def get_template_formatter(template_format: PromptTemplateFormat) -> TemplateFormatter:
    if template_format is PromptTemplateFormat.MUSTACHE:
        return MustacheTemplateFormatter()
    if template_format is PromptTemplateFormat.F_STRING:
        return FStringTemplateFormatter()
    if template_format is PromptTemplateFormat.NONE:
        return NoOpFormatter()
    assert_never(template_format)
