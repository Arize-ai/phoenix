import re
from abc import ABC, abstractmethod
from collections.abc import Iterable
from string import Formatter
from typing import Any

from jsonpath_ng import parse as jsonpath_parse
from jsonpath_ng.exceptions import JsonPathParserError  # type: ignore[import-untyped]
from typing_extensions import assert_never

from phoenix.server.api.helpers.prompts.models import PromptTemplateFormat


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
    Mustache template formatter.

    Examples:

    >>> formatter = MustacheTemplateFormatter()
    >>> formatter.format("{{ hello }}", hello="world")
    'world'
    """

    PATTERN = re.compile(r"(?<!\\){{\s*(\w+)\s*}}")

    def parse(self, template: str) -> set[str]:
        return set(match for match in re.findall(self.PATTERN, template))

    def _format(self, template: str, variable_names: Iterable[str], **variables: Any) -> str:
        for variable_name in variable_names:
            replacement = str(variables[variable_name])
            # Use a lambda instead of passing the replacement string directly. When re.sub
            # receives a string as `repl`, it interprets backslash escape sequences like \u, \n,
            # \1, etc. This causes errors when the replacement contains JSON with Unicode escapes
            # (e.g., \u2019). A callable `repl` returns the string literally without processing.
            template = re.sub(
                pattern=rf"(?<!\\){{{{\s*{variable_name}\s*}}}}",
                repl=lambda _: replacement,
                string=template,
            )
        return template


class JSONPathTemplateFormatter(TemplateFormatter):
    """
    JSONPath template formatter.

    Uses single brackets with JSONPath syntax: {$.path.to.value}

    Examples:

    >>> formatter = JSONPathTemplateFormatter()
    >>> formatter.format("{$.name}", name="world")
    'world'
    >>> formatter.format("{$.user.name}", user={"name": "Alice"})
    'Alice'
    """

    PATTERN = re.compile(r"(?<!\\)\{\$\.[^}]+\}")

    def parse(self, template: str) -> set[str]:
        """Extract JSONPath expressions from template."""
        matches = re.findall(self.PATTERN, template)
        variable_names = set()
        for match in matches:
            # Extract the JSONPath expression (remove { and })
            jsonpath_expr = match[1:-1]  # Remove { and }
            variable_names.add(jsonpath_expr)
        return variable_names

    def format(self, template: str, **variables: Any) -> str:
        """
        Format template with JSONPath expressions.
        Unlike other formatters, this does not raise errors for unmatched paths.
        """
        variable_names = self.parse(template)
        return self._format(template, variable_names, **variables)

    def _format(self, template: str, variable_names: Iterable[str], **variables: Any) -> str:
        """Format template by substituting JSONPath expressions with values."""
        result = template
        for jsonpath_expr in variable_names:
            try:
                parsed = jsonpath_parse(jsonpath_expr)
                # Find matches in the variables data
                matches = parsed.find(variables)
                if matches:
                    # Use the first match value
                    value = matches[0].value
                    replacement = str(value)
                    # Replace the JSONPath expression in the template
                    # Use a lambda to avoid backslash escape processing
                    result = re.sub(
                        pattern=rf"(?<!\\)\{{{re.escape(jsonpath_expr)}\}}",
                        repl=lambda _: replacement,
                        string=result,
                    )
                # If no matches, leave the expression as-is
            except JsonPathParserError:
                # If parsing fails, leave as-is
                pass
        return result


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
    if template_format is PromptTemplateFormat.JSON_PATH:
        return JSONPathTemplateFormatter()
    assert_never(template_format)
