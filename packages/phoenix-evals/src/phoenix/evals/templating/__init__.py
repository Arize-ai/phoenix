import re
from abc import ABC, abstractmethod
from enum import Enum
from string import Formatter
from typing import Any, Dict, List, Mapping, Optional, Sequence, TypedDict


class TemplateFormat(str, Enum):
    MUSTACHE = "mustache"
    F_STRING = "f_string"


class TemplateResult(TypedDict):
    prompt: str
    schema: Dict[str, Any]


class TemplateFormatter(ABC):
    @abstractmethod
    def render(self, template: str, variables: Dict[str, Any]) -> str:
        pass

    @abstractmethod
    def extract_variables(self, template: str) -> List[str]:
        pass


class MustacheFormatter(TemplateFormatter):
    def render(self, template: str, variables: Dict[str, Any]) -> str:
        try:
            import pystache  # type: ignore

            return pystache.render(template, variables)  # type: ignore
        except ImportError:
            result = template
            for key, value in variables.items():
                result = result.replace(f"{{{{{key}}}}}", str(value))
            return result

    def extract_variables(self, template: str) -> List[str]:
        try:
            import pystache

            parsed = pystache.parse(template)
            variables: List[str] = []
            self._extract_from_parsed(parsed, variables)
            return list(set(variables))
        except ImportError:
            import re

            pattern = r"\{\{\s*([^}]+)\s*\}\}"
            return [match.strip() for match in re.findall(pattern, template)]

    def _extract_from_parsed(self, parsed: Any, variables: List[str]) -> None:
        try:
            for element in parsed:
                if hasattr(element, "key") and element.key:
                    variables.append(element.key)
                elif hasattr(element, "parsed") and element.parsed:
                    self._extract_from_parsed(element.parsed, variables)
        except (AttributeError, TypeError):
            pass


class DotKeyFormatter(Formatter):
    def get_field(self, field_name: str, args: Sequence[Any], kwargs: Mapping[str, Any]) -> Any:
        # Treat the entire field_name as a single key without splitting at dots
        obj = self.get_value(field_name, args, kwargs)
        return obj, field_name


class FStringFormatter(TemplateFormatter):
    """
    Formatter for f-string style templates using standard Python f-string syntax.

    Users must properly escape JSON braces: use {{"key": "value"}} for literal JSON.
    Malformed templates like {"key": "value"} will raise clear KeyErrors.
    """

    def render(self, template: str, variables: Dict[str, Any]) -> str:
        formatter = DotKeyFormatter()
        return formatter.format(template, **variables)

    def extract_variables(self, template: str) -> List[str]:
        """Extract only template variables, excluding JSON content."""
        pattern = r"\{([^}]+)\}"
        potential_vars = re.findall(pattern, template)

        valid_vars = []
        for var in potential_vars:
            content = var.strip()

            if any(char in content for char in ['"', "'", ":", ",", "[", "]"]):
                continue

            try:
                float(content)
                continue
            except ValueError:
                pass

            if content.lower() in ["true", "false", "null"]:
                continue

            valid_vars.append(content)

        return valid_vars


def detect_template_format(template: str) -> TemplateFormat:
    """
    Detect the template format of a given template string.

    Automatically detects whether a template uses mustache ({{variable}}) or
    f-string ({variable}) formatting, while being robust to JSON content.

    **Ambiguity Warning**: F-string escaped JSON ({{...}}) is syntactically identical
    to mustache variables. In ambiguous cases, explicitly specify the template_format
    parameter when creating a Template.

    Args:
        template: The template string to analyze

    Returns:
        The detected TemplateFormat (MUSTACHE or F_STRING)

    Examples:
        >>> detect_template_format("Hello {{name}}")
        <TemplateFormat.MUSTACHE: 'mustache'>

        >>> detect_template_format("Hello {name}")
        <TemplateFormat.F_STRING: 'f_string'>

        >>> detect_template_format('Data: {"key": "value"} for {user}')
        <TemplateFormat.F_STRING: 'f_string'>

        >>> detect_template_format('JSON: {{"key": "value"}}')
        <TemplateFormat.MUSTACHE: 'mustache'>
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

        if content.lower() in ["true", "false", "null"]:
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
        """Auto-detect template format and create appropriate formatter."""
        format_type = detect_template_format(template)
        return cls.create(format_type)


class Template:
    """
    A template for LLM evaluation that renders prompts with provided JSON schemas.

    This class provides a simple interface for creating evaluation templates that work
    directly with LLM.generate_object() methods. It supports mustache and f-string template
    formats with auto-detection, and uses a provided JSON schema for structured output.

    Args:
        template: Template string with variables (e.g., "Classify: {{text}}" or "Classify: {text}")
        schema: JSON schema dict for structured output validation
        template_format: Template format (MUSTACHE or F_STRING). If None, auto-detects format.

    Examples:
        Basic classification schema with auto-detection:
        >>> schema = {
        ...     "type": "object",
        ...     "properties": {
        ...         "classification": {
        ...             "type": "string",
        ...             "enum": ["positive", "negative", "neutral"]
        ...         }
        ...     },
        ...     "required": ["classification"]
        ... }
        >>> template = Template(
        ...     template="Classify sentiment: {{text}}",  # Auto-detected as mustache
        ...     schema=schema
        ... )
        >>> result = template.render({"text": "Great product!"})
        >>> llm.generate_object(result["prompt"], result["schema"])

        Complex schema with explanation:
        >>> schema = {
        ...     "type": "object",
        ...     "properties": {
        ...         "response": {
        ...             "type": "array",
        ...             "items": [
        ...                 {"type": "string", "description": "Explanation"},
        ...                 {"type": "string", "enum": ["excellent", "good", "poor"]}
        ...             ]
        ...         }
        ...     }
        ... }
        >>> template = Template(
        ...     template="Rate quality: {response}",  # Auto-detected as f-string
        ...     schema=schema
        ... )

        Explicit template formats:
        >>> # Mustache format
        >>> template = Template(
        ...     template="Classify: {{text}}",
        ...     schema=schema,
        ...     template_format=TemplateFormat.MUSTACHE
        ... )

        >>> # F-string format
        >>> template = Template(
        ...     template="Classify: {text}",
        ...     schema=schema,
        ...     template_format=TemplateFormat.F_STRING
        ... )

        Robust to JSON content:
        >>> # This template contains JSON but auto-detects correctly
        >>> template = Template(
        ...     template='Analyze this data: {"key": "value"} for user {user_id}',
        ...     schema=schema
        ... )  # Auto-detected as f-string (ignores JSON content)
    """

    def __init__(
        self,
        *,
        template: str,
        schema: Dict[str, Any],
        template_format: Optional[TemplateFormat] = None,
    ):
        if not template:
            raise ValueError("Template cannot be empty")
        if not isinstance(schema, dict):
            raise TypeError(f"Schema must be a dictionary, got {type(schema)}")
        self.template = template
        self.schema = schema

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

    def render(self, variables: Dict[str, Any]) -> TemplateResult:
        if not isinstance(variables, dict):
            raise TypeError(f"Variables must be a dictionary, got {type(variables)}")
        rendered_prompt = self._formatter.render(self.template, variables)
        return TemplateResult(prompt=rendered_prompt, schema=self.schema)
