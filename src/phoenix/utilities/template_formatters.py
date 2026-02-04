import re
from abc import ABC, abstractmethod
from collections.abc import Iterable
from string import Formatter
from typing import Any, cast

import pystache
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

    def _extract_variables_from_parse_tree(self, parse_tree: list[Any]) -> set[str]:
        """
        Extract top-level variable names from a pystache parse tree.

        Only extracts variables at the top level (depth 0), not those nested
        inside sections.
        """
        variables: set[str] = set()
        for node in parse_tree:
            node_type = type(node).__name__
            if node_type in {"_SectionNode", "_InvertedNode"}:
                key = self._extract_key(node)
                if key:
                    variables.add(self._get_root_variable_name(key))
                # Don't recurse into section children - we only want top-level vars
                continue
            if node_type in {"_EscapeNode", "_LiteralNode"}:
                key = self._extract_key(node)
                if key:
                    variables.add(self._get_root_variable_name(key))
        return variables

    def _fallback_extract_variables(self, template: str) -> tuple[set[str], int]:
        """
        Regex-based fallback for variable extraction when native parser fails.

        Best-effort extraction that handles most common Mustache patterns.

        Returns:
            A tuple of (variables, final_depth) where final_depth > 0 indicates
            unclosed sections.
        """
        variables: set[str] = set()
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
                        variables.add(self._get_root_variable_name(var_name))
                continue
            # Skip malformed triple braces captured as `{name`
            if trimmed.startswith("{"):
                continue
            # Handle sections
            if trimmed.startswith("#") or trimmed.startswith("^"):
                if depth == 0:
                    var_name = trimmed[1:].strip()
                    variables.add(self._get_root_variable_name(var_name))
                depth += 1
                continue
            # Handle section closers
            if trimmed.startswith("/"):
                depth = max(0, depth - 1)
                continue
            # Regular variables at top level
            if depth == 0:
                variables.add(self._get_root_variable_name(trimmed))
        return variables, depth

    def parse(self, template: str) -> set[str]:
        """
        Extract top-level variable names from mustache template.

        Uses native-parser-first approach: tries pystache.parse() first for
        spec-consistent parsing. Falls back to regex-based extraction when:
        - The native parser fails with an exception
        - The template has unclosed sections (depth > 0), since pystache may
          produce unexpected results for malformed templates

        Only extracts variables at the top level, not those nested inside sections.
        This ensures validation only checks for required top-level inputs.
        For dotted paths like {{output.available_tools}}, only the root variable
        name (output) is extracted, since Mustache traverses nested properties
        starting from the root.
        """
        # First, do a quick regex scan to check for unclosed sections
        # This is needed because pystache may not throw on malformed templates
        # but produces unexpected parse trees for unclosed sections
        fallback_vars, depth = self._fallback_extract_variables(template)
        if depth > 0:
            # Template has unclosed sections - use regex result
            return fallback_vars

        # Template is well-formed (sections balanced), try native parser
        try:
            parse_tree = self._get_parse_tree(template)
            return self._extract_variables_from_parse_tree(parse_tree)
        except Exception:
            # Fall back to regex-based extraction
            return fallback_vars

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
