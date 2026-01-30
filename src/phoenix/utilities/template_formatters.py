import re
from abc import ABC, abstractmethod
from collections.abc import Iterable
from string import Formatter
from typing import Any, cast

import pystache
from typing_extensions import assert_never

from phoenix.server.api.helpers.prompts.models import PromptTemplateFormat


class DictWrapper:
    """
    Wraps a dict to support attribute access for f-string formatting.

    This allows f-string templates like `{reference.label}` to work with
    dict variables like `{"reference": {"label": "value"}}`.

    Examples:

    >>> wrapper = DictWrapper({"user": {"name": "Alice"}})
    >>> wrapper.user.name
    'Alice'
    >>> wrapper["user"]["name"]
    'Alice'
    """

    def __init__(self, data: dict[str, Any]) -> None:
        # Use object.__setattr__ to avoid triggering __getattr__
        object.__setattr__(self, "_data", data)

    def __getattr__(self, name: str) -> Any:
        if name.startswith("_"):
            raise AttributeError(name)
        try:
            value = self._data[name]
        except KeyError:
            raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")
        return _wrap_value(value)

    def __getitem__(self, key: Any) -> Any:
        value = self._data[key]
        return _wrap_value(value)

    def __repr__(self) -> str:
        return f"DictWrapper({self._data!r})"


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


def _wrap_value(value: Any) -> Any:
    """Recursively wrap dicts and lists for attribute access."""
    if isinstance(value, dict):
        return DictWrapper(value)
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

    Examples:

    >>> formatter = FStringTemplateFormatter()
    >>> formatter.format("{hello}", hello="world")
    'world'
    >>> formatter.format("{user.name}", user={"name": "Alice"})
    'Alice'
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

    Escaped sequences (\\{{ ... }}) are preserved and not replaced.
    HTML escaping is disabled - values are rendered as-is.

    Examples:

    >>> formatter = MustacheTemplateFormatter()
    >>> formatter.format("{{ hello }}", hello="world")
    'world'
    """

    # Pattern to find escaped mustache sequences (backslash before {{)
    _ESCAPED_PATTERN = r"\\(\{\{)"
    # Placeholder that won't appear in normal templates
    _ESCAPED_PLACEHOLDER = "\x00ESCAPED_BRACE\x00"
    # Pattern to extract all {{...}} sequences
    _VARIABLE_PATTERN = r"\{\{\s*([^}]+?)\s*\}\}"

    def __init__(self) -> None:
        self._escape_regex = re.compile(self._ESCAPED_PATTERN)
        self._variable_regex = re.compile(self._VARIABLE_PATTERN)
        # Create renderer with no HTML escaping
        self._renderer = pystache.Renderer(escape=lambda x: x)

    def parse(self, template: str) -> set[str]:
        """
        Extract top-level variable names from mustache template.

        Only extracts variables at the top level, not those nested inside sections.
        This ensures validation only checks for required top-level inputs.
        Escaped sequences (\\{{) are ignored.

        This implementation uses regex with depth tracking to match the TypeScript
        implementation in mustacheLikeTemplating.ts, avoiding private pystache APIs.
        """
        # Temporarily remove escaped sequences before parsing
        clean_template = self._escape_regex.sub(self._ESCAPED_PLACEHOLDER, template)

        # Find all {{...}} patterns
        matches = self._variable_regex.findall(clean_template)

        variables: set[str] = set()
        depth = 0

        for variable in matches:
            trimmed = variable.strip()
            if not trimmed:
                continue

            # Section opener (# or ^) - only add variable if at top level
            if trimmed.startswith("#") or trimmed.startswith("^"):
                if depth == 0:
                    variables.add(trimmed[1:].strip())
                depth += 1
                continue

            # Section closer (/)
            if trimmed.startswith("/"):
                depth = max(0, depth - 1)
                continue

            # Regular variable - only add if at top level
            if depth == 0:
                variables.add(trimmed)

        return variables

    def _format(self, template: str, variable_names: Iterable[str], **variables: Any) -> str:
        # Temporarily replace escaped sequences before rendering
        clean_template = self._escape_regex.sub(self._ESCAPED_PLACEHOLDER, template)
        # Render with pystache (no HTML escaping)
        result = self._renderer.render(clean_template, variables)
        # Restore escaped sequences (without the backslash, keeping the braces)
        rendered = result.replace(self._ESCAPED_PLACEHOLDER, r"\{{")
        return cast(str, rendered)


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
