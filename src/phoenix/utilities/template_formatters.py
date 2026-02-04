import re
from abc import ABC, abstractmethod
from collections.abc import Iterable
from dataclasses import dataclass
from string import Formatter
from typing import Any, Literal, cast

import pystache
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
    Mustache template formatter using pystache.

    Supports full Mustache syntax including sections ({{#list}}...{{/list}}),
    inverted sections ({{^field}}...{{/field}}), and nested properties.

    HTML escaping is disabled - values are rendered as-is.

    Uses a native-parser-first approach: tries pystache.parse() first for
    spec-consistent parsing. Falls back to regex-based extraction only when
    the native parser fails.

    Examples:

    >>> formatter = MustacheTemplateFormatter()
    >>> formatter.format("{{ hello }}", hello="world")
    'world'
    """

    def __init__(self) -> None:
        # Create renderer with no HTML escaping
        self._renderer = pystache.Renderer(escape=lambda x: x)
        self._fallback_regex = re.compile(r"\{\{\s*([^}]+?)\s*\}\}")

    @staticmethod
    def _get_parse_tree(template: str) -> list[Any]:
        parsed = pystache.parse(template)
        parse_tree = getattr(parsed, "_parse_tree", None)
        if parse_tree is None:
            if isinstance(parsed, list):
                parse_tree = parsed
            else:
                raise TemplateFormatterError("Unable to access pystache parse tree.")
        if not isinstance(parse_tree, list):
            raise TemplateFormatterError("Unexpected pystache parse tree format.")
        return parse_tree

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
        Regular variables ({{name}}) are typed as "string".
        """
        variables: dict[str, Literal["string", "section"]] = {}
        for node in parse_tree:
            node_type = type(node).__name__
            if node_type in {"_SectionNode", "_InvertedNode"}:
                key = self._extract_key(node)
                if key:
                    root_name = self._get_root_variable_name(key)
                    variables[root_name] = "section"
                continue
            if node_type in {"_EscapeNode", "_LiteralNode"}:
                key = self._extract_key(node)
                if key:
                    root_name = self._get_root_variable_name(key)
                    variables.setdefault(root_name, "string")
        return variables

    def _fallback_extract_variables_with_types(
        self, template: str
    ) -> tuple[dict[str, Literal["string", "section"]], int]:
        """
        Regex-based fallback for variable extraction with types when native parser fails.

        Returns:
            A tuple of (variables, final_depth) where final_depth > 0 indicates
            unclosed sections.
        """
        variables: dict[str, Literal["string", "section"]] = {}
        depth = 0
        for match in self._fallback_regex.findall(template):
            trimmed = match.strip()
            if not trimmed:
                continue
            # Skip comments, partials, delimiter changes
            if trimmed.startswith("!") or trimmed.startswith(">") or trimmed.startswith("="):
                continue
            # Handle unescaped variables ({{& name}})
            if trimmed.startswith("&"):
                if depth == 0:
                    var_name = trimmed[1:].strip()
                    if var_name:
                        root_name = self._get_root_variable_name(var_name)
                        variables.setdefault(root_name, "string")
                continue
            # Skip malformed triple braces captured as `{name`
            if trimmed.startswith("{"):
                continue
            # Handle sections
            if trimmed.startswith("#") or trimmed.startswith("^"):
                if depth == 0:
                    var_name = trimmed[1:].strip()
                    root_name = self._get_root_variable_name(var_name)
                    variables[root_name] = "section"
                depth += 1
                continue
            # Handle section closers
            if trimmed.startswith("/"):
                depth = max(0, depth - 1)
                continue
            # Regular variables at top level
            if depth == 0:
                root_name = self._get_root_variable_name(trimmed)
                variables.setdefault(root_name, "string")
        return variables, depth

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

        Uses native-parser-first approach: tries pystache.parse() first for
        spec-consistent parsing. Falls back to regex-based extraction when:
        - The native parser fails with an exception
        - The template has unclosed sections (depth > 0), since pystache may
          produce unexpected results for malformed templates

        Section variables ({{#name}} or {{^name}}) are typed as "section".
        Regular variables ({{name}}) are typed as "string".

        For dotted paths like {{output.available_tools}}, only the root variable
        name (output) is extracted, since Mustache traverses nested properties
        starting from the root.
        """
        # First, do a quick regex scan to check for unclosed sections
        fallback_vars, depth = self._fallback_extract_variables_with_types(template)
        if depth > 0:
            # Template has unclosed sections - use regex result
            variables = fallback_vars
        else:
            # Template is well-formed (sections balanced), try native parser
            try:
                parse_tree = self._get_parse_tree(template)
                variables = self._extract_variables_from_parse_tree_with_types(parse_tree)
            except Exception:
                # Fall back to regex-based extraction
                variables = fallback_vars

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
