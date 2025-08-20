import json
import re
from abc import ABC, abstractmethod
from enum import Enum
from inspect import BoundArguments
from string import Formatter
from textwrap import dedent
from typing import Any, Dict, List, Optional, cast

import pystache  # type: ignore
from opentelemetry.trace import Tracer


def _get_template(bound: BoundArguments) -> str:
    return cast(str, bound.arguments["self"].template)


def _get_variables(bound: BoundArguments) -> str:
    variables = bound.arguments["variables"]
    return json.dumps(variables)


def _get_output(result: str) -> str:
    return result


class TemplateFormat(str, Enum):
    MUSTACHE = "mustache"
    F_STRING = "f-string"


class TemplateFormatter(ABC):
    @abstractmethod
    def render(self, template: str, variables: Dict[str, Any]) -> str:
        pass

    @abstractmethod
    def extract_variables(self, template: str) -> List[str]:
        pass


class MustacheFormatter(TemplateFormatter):
    def render(self, template: str, variables: Dict[str, Any]) -> str:
        return pystache.render(template, variables)  # type: ignore

    def extract_variables(self, template: str) -> List[str]:
        parsed = pystache.parse(template)
        variables: List[str] = []
        self._extract_from_parsed(parsed, variables)
        return list(set(variables))

    def _extract_from_parsed(self, parsed: Any, variables: List[str]) -> None:
        try:
            # ParsedTemplate stores elements in _parse_tree attribute
            elements = parsed
            if hasattr(parsed, "_parse_tree"):
                elements = parsed._parse_tree

            for element in elements:
                if hasattr(element, "key") and element.key:
                    variables.append(element.key)
                elif hasattr(element, "parsed") and element.parsed:
                    self._extract_from_parsed(element.parsed, variables)
        except (AttributeError, TypeError):
            pass


class FStringFormatter(TemplateFormatter):
    """Formatter for f-string style templates using standard Python string formatting."""

    def render(self, template: str, variables: Dict[str, Any]) -> str:
        """Use Python's built-in Formatter for f-string-like behavior."""
        formatter = Formatter()
        return formatter.format(template, **variables)

    def extract_variables(self, template: str) -> List[str]:
        """Extract variable names from template using Python's string formatter."""
        formatter = Formatter()
        field_names = []

        # Parse the template to extract field names
        for literal_text, field_name, format_spec, conversion in formatter.parse(template):
            if field_name is not None:
                # Extract the base variable name (before dots, brackets, etc.)
                base_name = field_name.split(".")[0].split("[")[0]
                if base_name and base_name not in field_names:
                    field_names.append(base_name)

        return field_names


def detect_template_format(template: str) -> TemplateFormat:
    """
    Detect whether a template uses mustache ({{variable}}) or f-string ({variable}) format.

    **Note**: Escaped JSON in f-strings ({{...}}) looks identical to mustache variables.
    Use explicit template_format parameter for ambiguous cases.
    """
    mustache_pattern = r"\{\{\s*([^}]+)\s*\}\}"
    fstring_pattern = r"\{([^}]+)\}"

    mustache_matches = re.findall(mustache_pattern, template)
    fstring_matches = re.findall(fstring_pattern, template)

    clear_mustache_vars = []
    potential_escaped_json = []

    for match in mustache_matches:
        content = match.strip()
        if any(char in content for char in ['"', "'", ":", ",", "[", "]"]):
            potential_escaped_json.append(content)
        else:
            clear_mustache_vars.append(content)

    clear_fstring_vars = []
    for match in fstring_matches:
        content = match.strip()

        if any(char in content for char in ['"', "'", ":", ",", "[", "]"]):
            continue

        try:
            float(content)
            continue
        except ValueError:
            pass

        if content in ["True", "False", "None"]:
            continue

        clear_fstring_vars.append(content)

    if clear_mustache_vars and not clear_fstring_vars:
        return TemplateFormat.MUSTACHE

    if clear_fstring_vars and not clear_mustache_vars:
        return TemplateFormat.F_STRING

    if clear_mustache_vars and clear_fstring_vars:
        return TemplateFormat.MUSTACHE

    if potential_escaped_json and clear_fstring_vars:
        return TemplateFormat.F_STRING

    if clear_mustache_vars and potential_escaped_json:
        return TemplateFormat.MUSTACHE

    if potential_escaped_json:
        return TemplateFormat.MUSTACHE

    return TemplateFormat.MUSTACHE


class FormatterFactory:
    _formatters = {
        TemplateFormat.MUSTACHE: MustacheFormatter,
        TemplateFormat.F_STRING: FStringFormatter,
    }

    @classmethod
    def create(cls, format_type: TemplateFormat) -> TemplateFormatter:
        formatter_class = cls._formatters.get(format_type)
        if not formatter_class:
            raise ValueError(f"Unsupported template format: {format_type}")
        return formatter_class()

    @classmethod
    def auto_detect_and_create(cls, template: str) -> TemplateFormatter:
        format_type = detect_template_format(template)
        return cls.create(format_type)


class Template:
    """
    Template for rendering prompts with mustache ({{variable}}) or f-string ({variable}) formats.

    Supports auto-detection of template format and handles JSON content correctly.
    """

    def __init__(
        self,
        *,
        template: str,
        template_format: Optional[TemplateFormat] = None,
    ):
        if not template:
            raise ValueError("Template cannot be empty")
        self.template = template

        if template_format is None:
            self.template_format = detect_template_format(template)
            self._formatter = FormatterFactory.auto_detect_and_create(template)
        else:
            self.template_format = template_format
            self._formatter = FormatterFactory.create(self.template_format)

        self._variables = self._formatter.extract_variables(self.template)

    @property
    def variables(self) -> List[str]:
        return self._variables

    def render(self, variables: Dict[str, Any], tracer: Optional[Tracer] = None) -> str:
        if not isinstance(variables, dict):  # pyright: ignore
            raise TypeError(f"Variables must be a dictionary, got {type(variables)}")
        return dedent(self._formatter.render(self.template, variables))
