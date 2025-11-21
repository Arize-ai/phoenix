import json
import re
from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from enum import Enum
from inspect import BoundArguments
from string import Formatter
from textwrap import dedent
from typing import Any, Dict, List, Optional, Union, cast

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
    """Abstract base class for template formatters."""

    @abstractmethod
    def render(self, template: str, variables: Dict[str, Any]) -> str:
        """Render a template with variables.

        Args:
            template (str): The template string to render.
            variables (Dict[str, Any]): The variables to substitute.

        Returns:
            str: The rendered template.
        """
        pass

    @abstractmethod
    def extract_variables(self, template: str) -> List[str]:
        """Extract variable names from a template.

        Args:
            template (str): The template string to analyze.

        Returns:
            List[str]: A list of variable names found in the template.
        """
        pass


class MustacheFormatter(TemplateFormatter):
    """Formatter for mustache-style templates using pystache."""

    def render(self, template: str, variables: Dict[str, Any]) -> str:
        """Render a mustache template with variables.

        Args:
            template (str): The mustache template string.
            variables (Dict[str, Any]): The variables to substitute.

        Returns:
            str: The rendered template.
        """
        return pystache.render(template, variables)  # type: ignore

    def extract_variables(self, template: str) -> List[str]:
        """Extract variable names from a mustache template.

        Args:
            template (str): The mustache template string.

        Returns:
            List[str]: A list of unique variable names found in the template.
        """
        parsed = pystache.parse(template)
        variables: List[str] = []
        self._extract_from_parsed(parsed, variables)
        return list(set(variables))

    def _extract_from_parsed(self, parsed: Any, variables: List[str]) -> None:
        """Recursively extract variable names from parsed mustache template.

        Args:
            parsed (Any): The parsed template object.
            variables (List[str]): List to accumulate variable names in.
        """
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

    class _DotKeyFormatter(Formatter):
        def get_field(self, field_name: str, args: Sequence[Any], kwargs: Mapping[str, Any]) -> Any:
            if args and isinstance(args[0], dict) and field_name in args[0]:
                return args[0][field_name], field_name
            return super().get_field(field_name, args, kwargs)

    def render(self, template: str, variables: Dict[str, Any]) -> str:
        """Use Python's built-in Formatter for f-string-like behavior.

        Args:
            template (str): The f-string template.
            variables (Dict[str, Any]): The variables to substitute.

        Returns:
            str: The rendered template.
        """
        formatter = self._DotKeyFormatter()
        safe_kwargs = {k: v for k, v in variables.items() if "." not in k}
        return formatter.vformat(template, (variables,), safe_kwargs)

    def extract_variables(self, template: str) -> List[str]:
        """Extract variable names from template using Python's string formatter.

        Args:
            template (str): The f-string template to analyze.

        Returns:
            List[str]: A list of unique variable names found in the template.
        """
        formatter = Formatter()
        field_names = []

        for _, field_name, _, _ in formatter.parse(template):
            if field_name is not None and field_name not in field_names:
                field_names.append(field_name)

        return field_names


def detect_template_format(template: str) -> TemplateFormat:
    """Detect whether a template uses mustache ({{variable}}) or f-string ({variable}) format.

    **Note**: Escaped JSON in f-strings ({{...}}) looks identical to mustache variables.
    Use explicit template_format parameter for ambiguous cases.

    Args:
        template (str): The template string to analyze.

    Returns:
        TemplateFormat: The detected template format (MUSTACHE or F_STRING).
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
        """Initialize a Template instance.

        Args:
            template (str): The template string to use.
            template_format (Optional[TemplateFormat]): The format of the template. If None,
                the format will be auto-detected.

        Raises:
            ValueError: If the template is empty.
        """
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
        """Get the list of variables used in the template.

        Returns:
            List[str]: A list of variable names found in the template.
        """
        return self._variables

    def render(self, variables: Dict[str, Any], tracer: Optional[Tracer] = None) -> str:
        """Render the template with the given variables.

        Args:
            variables (Dict[str, Any]): The variables to substitute into the template.
            tracer (Optional[Tracer]): Optional tracer for tracing operations.

        Returns:
            str: The rendered template.

        Raises:
            TypeError: If variables is not a dictionary.
        """
        if not isinstance(variables, dict):  # pyright: ignore
            raise TypeError(f"Variables must be a dictionary, got {type(variables)}")
        return dedent(self._formatter.render(self.template, variables))


class PromptTemplate:
    """
    Unified template class for rendering prompts with either string or message list format.

    Supports:
    - String templates with mustache ({{variable}}) or f-string ({variable}) formats
    - OpenAI-style message lists with role and content fields

    Provides a uniform interface regardless of the internal template format.
    """

    def __init__(
        self,
        *,
        template: Union[str, List[Dict[str, Any]]],
        template_format: Optional[TemplateFormat] = None,
    ):
        """Initialize a PromptTemplate instance.

        Args:
            template: Either a string template or a list of message dicts with role and content.
            template_format: Optional format specification (F_STRING or MUSTACHE).
                If None, format will be auto-detected for string templates.

        Raises:
            ValueError: If the template is empty.
            TypeError: If template is not a string or list.
        """
        if isinstance(template, str):
            if not template:
                raise ValueError("Template cannot be empty")
            self._is_string = True
            self._template = template

            # Create formatter for string template
            if template_format is None:
                self.template_format = detect_template_format(template)
                self._formatter = FormatterFactory.auto_detect_and_create(template)
            else:
                self.template_format = template_format
                self._formatter = FormatterFactory.create(self.template_format)

            # Extract variables from string template
            self._variables = self._formatter.extract_variables(self._template)

        elif isinstance(template, list):
            self._is_string = False
            self._template = template
            # Store user-specified format (None means auto-detect per message)
            self._template_format = template_format
            self.template_format = template_format or TemplateFormat.F_STRING

            # Extract variables from all message content fields
            variables_set: set[str] = set()
            for msg in template:
                if "content" in msg and msg["content"]:
                    formatter = self._get_formatter_for_content(msg["content"])
                    msg_variables = formatter.extract_variables(msg["content"])
                    variables_set.update(msg_variables)

            self._variables = list(variables_set)
        else:
            raise TypeError(
                f"Template must be a string or list of message dicts, got {type(template)}"
            )

    def _get_formatter_for_content(self, content: str) -> TemplateFormatter:
        """Get the appropriate formatter for message content.

        Args:
            content: The message content to format.

        Returns:
            TemplateFormatter: Auto-detected formatter if template_format was None,
                otherwise formatter for the user-specified format.
        """
        if self._template_format is None:
            # Auto-detect format for this specific content
            msg_format = detect_template_format(content)
            return FormatterFactory.create(msg_format)
        else:
            # Use user-specified format
            return FormatterFactory.create(self._template_format)

    @property
    def template(self) -> Union[str, List[Dict[str, Any]]]:
        """Get the raw template.

        Returns:
            The template in its original format (str or List[Dict]).
        """
        return self._template

    @property
    def variables(self) -> List[str]:
        """Get the list of variables used in the template.

        Returns:
            List[str]: A list of variable names found in the template.
        """
        return self._variables

    def render(
        self, variables: Dict[str, Any], tracer: Optional[Tracer] = None
    ) -> Union[str, List[Dict[str, Any]]]:
        """Render the template with the given variables.

        Args:
            variables: The variables to substitute into the template.
            tracer: Optional tracer for tracing operations.

        Returns:
            Rendered template in the same format as input (str or List[Dict]).

        Raises:
            TypeError: If variables is not a dictionary.
        """
        if not isinstance(variables, dict):  # pyright: ignore
            raise TypeError(f"Variables must be a dictionary, got {type(variables)}")

        if self._is_string:
            # Render string template
            rendered = self._formatter.render(self._template, variables)  # type: ignore
            return dedent(rendered)
        else:
            # Render message list
            rendered_messages = []
            for msg in self._template:  # type: ignore
                rendered_msg = msg.copy()  # Preserve all fields including extras
                if "content" in msg:
                    formatter = self._get_formatter_for_content(msg["content"])
                    rendered_content = formatter.render(msg["content"], variables)
                    rendered_msg["content"] = dedent(rendered_content)
                rendered_messages.append(rendered_msg)
            return rendered_messages


def render_template(
    template: Union[str, List[Dict[str, Any]]],
    variables: Dict[str, Any],
    template_format: Optional[TemplateFormat] = None,
) -> Union[str, List[Dict[str, Any]]]:
    """Render a template with variables.

    Supports both string templates and OpenAI-style message lists.
    For message lists, renders the content field of each message.

    Args:
        template: Either a string template or a list of message dicts with role and content.
        variables: Variables to substitute into the template.
        template_format: Optional format specification (F_STRING or MUSTACHE).
            If None, format will be auto-detected for string templates.

    Returns:
        Rendered template in the same format as input (str or List[Dict]).

    Raises:
        TypeError: If template is not a string or list.
    """
    prompt_template = PromptTemplate(template=template, template_format=template_format)
    return prompt_template.render(variables)
