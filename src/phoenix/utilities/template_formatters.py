import re
from abc import ABC, abstractmethod
from collections.abc import Iterable
from string import Formatter
from typing import Any

from typing_extensions import assert_never

from phoenix.server.api.helpers.prompts.models import PromptTemplateFormat


def _resolve_path(obj: Any, path: str) -> Any:
    """
    Resolve a dot-notation path with optional array indexing.

    Supports paths like:
    - "input" -> simple key access
    - "input.query" -> nested key access
    - "messages[0]" -> array index access
    - "input.messages[0].content" -> combined access

    Args:
        obj: The object to traverse (dict or list)
        path: The dot-notation path with optional bracket indexing

    Returns:
        The value at the specified path

    Raises:
        KeyError: If a key doesn't exist
        IndexError: If an array index is out of bounds
        TypeError: If the path traverses through an incompatible type
    """
    if not path:
        return obj

    # Parse the path into segments, handling both dots and brackets
    # e.g., "input.messages[0].content" -> ["input", "messages", "[0]", "content"]
    segments: list[str] = []
    current_segment = ""

    i = 0
    while i < len(path):
        char = path[i]
        if char == ".":
            if current_segment:
                segments.append(current_segment)
                current_segment = ""
        elif char == "[":
            if current_segment:
                segments.append(current_segment)
                current_segment = ""
            # Find the closing bracket
            bracket_end = path.find("]", i)
            if bracket_end == -1:
                raise ValueError(f"Unclosed bracket in path: {path}")
            segments.append(path[i : bracket_end + 1])
            i = bracket_end
        else:
            current_segment += char
        i += 1

    if current_segment:
        segments.append(current_segment)

    # Traverse the path
    current = obj
    for segment in segments:
        if segment.startswith("[") and segment.endswith("]"):
            # Array index access
            index_str = segment[1:-1]
            try:
                index = int(index_str)
            except ValueError:
                raise ValueError(f"Invalid array index: {index_str}")

            if not isinstance(current, (list, tuple)):
                raise TypeError(
                    f"Cannot use array index on non-list type: {type(current).__name__}"
                )
            current = current[index]
        else:
            # Dictionary key access
            if not isinstance(current, dict):
                raise TypeError(
                    f"Cannot access key '{segment}' on non-dict type: {type(current).__name__}"
                )
            if segment not in current:
                raise KeyError(f"Key '{segment}' not found")
            current = current[segment]

    return current


def _get_root_key(path: str) -> str:
    """
    Extract the root key from a path expression.

    Examples:
    - "input" -> "input"
    - "input.query" -> "input"
    - "messages[0]" -> "messages"
    - "input.messages[0].content" -> "input"
    """
    # Find the first delimiter (dot or bracket)
    dot_pos = path.find(".")
    bracket_pos = path.find("[")

    if dot_pos == -1 and bracket_pos == -1:
        return path
    elif dot_pos == -1:
        return path[:bracket_pos]
    elif bracket_pos == -1:
        return path[:dot_pos]
    else:
        return path[: min(dot_pos, bracket_pos)]


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
        if missing_template_variables := template_variable_names - set(variables.keys()):
            raise TemplateFormatterError(
                f"Missing template variable(s): {', '.join(missing_template_variables)}"
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

    Examples:

    >>> formatter = FStringTemplateFormatter()
    >>> formatter.format("{hello}", hello="world")
    'world'
    """

    def parse(self, template: str) -> set[str]:
        return set(field_name for _, field_name, _, _ in Formatter().parse(template) if field_name)

    def _format(self, template: str, variable_names: Iterable[str], **variables: Any) -> str:
        return template.format(**variables)


class MustacheTemplateFormatter(TemplateFormatter):
    """
    Mustache template formatter with dot notation and array indexing support.

    This is a Phoenix-specific extension of mustache syntax that supports:
    - Simple variables: {{name}}
    - Dot notation: {{input.query}}
    - Array indexing: {{messages[0]}}
    - Combined paths: {{input.messages[0].content}}

    Note: Standard Mustache uses sections for iteration and does not support
    array indexing. This is a custom extension for Phoenix.

    Examples:

    >>> formatter = MustacheTemplateFormatter()
    >>> formatter.format("{{ hello }}", hello="world")
    'world'
    >>> formatter.format("{{ user.name }}", user={"name": "Alice"})
    'Alice'
    >>> formatter.format("{{ items[0] }}", items=["first", "second"])
    'first'
    """

    # Pattern matches variable paths including dots and brackets
    # Examples: "name", "input.query", "messages[0]", "input.messages[0].content"
    PATTERN = re.compile(r"(?<!\\){{\s*([\w][\w.\[\]0-9]*)\s*}}")

    def parse(self, template: str) -> set[str]:
        """Parse template and return set of variable paths."""
        return set(match for match in re.findall(self.PATTERN, template))

    def format(self, template: str, **variables: Any) -> str:
        """
        Formats the template with the given variables.

        Overrides base class to validate root keys exist for path expressions.
        """
        template_variable_paths = self.parse(template)
        # Extract root keys from paths for validation
        root_keys = {_get_root_key(path) for path in template_variable_paths}
        if missing_root_keys := root_keys - set(variables.keys()):
            raise TemplateFormatterError(
                f"Missing template variable(s): {', '.join(sorted(missing_root_keys))}"
            )
        return self._format(template, template_variable_paths, **variables)

    def _format(self, template: str, variable_names: Iterable[str], **variables: Any) -> str:
        for variable_path in variable_names:
            try:
                value = _resolve_path(variables, variable_path)
            except (KeyError, IndexError, TypeError, ValueError) as e:
                raise TemplateFormatterError(f"Failed to resolve path '{variable_path}': {e}")
            replacement = str(value)
            # Use a lambda instead of passing the replacement string directly. When re.sub
            # receives a string as `repl`, it interprets backslash escape sequences like \u, \n,
            # \1, etc. This causes errors when the replacement contains JSON with Unicode escapes
            # (e.g., \u2019). A callable `repl` returns the string literally without processing.
            # Escape special regex characters in the path for the pattern
            escaped_path = re.escape(variable_path)
            template = re.sub(
                pattern=rf"(?<!\\){{{{\s*{escaped_path}\s*}}}}",
                repl=lambda _: replacement,
                string=template,
            )
        return template


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
