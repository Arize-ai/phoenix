"""
Prompt and message template abstractions for LLM interactions.

This module provides a unified interface for working with prompts in various formats:
- Simple string prompts
- OpenAI-style message lists
- Structured content parts (text, image_url, etc.)

The module supports template rendering with variable substitution using either
mustache ({{variable}}) or f-string ({variable}) syntax.
"""

import re
import warnings
from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from enum import Enum
from string import Formatter
from textwrap import dedent
from typing import Any, Dict, List, Literal, Optional, TypedDict, Union, cast

import pystache  # type: ignore
from opentelemetry.trace import Tracer


class TemplateFormat(str, Enum):
    MUSTACHE = "mustache"
    F_STRING = "f-string"


class MessageRole(str, Enum):
    USER = "user"
    AI = "assistant"
    SYSTEM = "system"


class TextContentPart(TypedDict):
    """Text content part for messages (OpenAI format)."""

    type: Literal["text"]
    text: str


# alias for the content part types
# add more content part types here as we expand to multimodal prompts
ContentPart = TextContentPart


class Message(TypedDict):
    role: MessageRole
    content: Union[str, List[ContentPart]]


# Type alias for prompt formats
PromptLike = Union[str, List[Dict[str, Any]], List[Message]]


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


class ContentPartTemplate(ABC):
    """Abstract base class for content part templates.

    Each content type (text, image, etc.) has its own template subclass
    that knows how to extract variables and render to the appropriate ContentPart format.
    """

    type: str
    format: TemplateFormat
    _formatter: TemplateFormatter

    @abstractmethod
    def variables(self) -> List[str]:
        """Extract variable names from this content part template.

        Returns:
            List[str]: A list of variable names found in the template.
        """
        pass

    @abstractmethod
    def render(self, variables: Dict[str, Any]) -> ContentPart:
        """Render this template to a concrete ContentPart.

        Args:
            variables: The variables to substitute into the template.

        Returns:
            ContentPart: The rendered content part (e.g., TextContentPart).
        """
        pass


class TextContentPartTemplate(ContentPartTemplate):
    """Template for text content parts."""

    def __init__(
        self,
        text: str,
        format: Optional[TemplateFormat] = None,
    ):
        """Initialize a text content part template.

        Args:
            text: The template text string.
            format: Optional format specification. If None, will be auto-detected.
        """
        self.type = "text"
        self.text = text

        if format is None:
            self.format = detect_template_format(text)
            self._formatter = FormatterFactory.auto_detect_and_create(text)
        else:
            self.format = format
            self._formatter = FormatterFactory.create(format)

    def variables(self) -> List[str]:
        """Extract variables from the text template."""
        return self._formatter.extract_variables(self.text)

    def render(self, variables: Dict[str, Any]) -> TextContentPart:
        """Render the text template to a TextContentPart."""
        rendered_text = self._formatter.render(self.text, variables)
        return TextContentPart(type="text", text=rendered_text)


# class ImageUrlContentPartTemplate(ContentPartTemplate):
#     """Template for image URL content parts.

#     Note: Currently treats image_url as static (no variable substitution).
#     Future enhancement could support templating in URL strings.
#     """

#     def __init__(
#         self,
#         image_url: Dict[str, Any],
#         format: Optional[TemplateFormat] = None,
#     ):
#         """Initialize an image URL content part template.

#         Args:
#             image_url: The image URL data (e.g., {"url": "..."}).
#             format: Optional format specification.
#         """
#         self.type = "image_url"
#         self.image_url = image_url
#         self.format = format or TemplateFormat.MUSTACHE

#     def variables(self) -> List[str]:
#         """Extract variables from the image URL.

#         Returns:
#             Empty list (no variable substitution in images yet).
#         """
#         raise NotImplementedError("Image URL content parts are not supported yet.")

#     def render(self, variables: Dict[str, Any]) -> ImageUrlContentPart:
#         """Render the image URL template to an ImageUrlContentPart."""
#         raise NotImplementedError("Image URL content parts are not supported yet.")


def create_content_part_template(
    content_part: Dict[str, Any],
    format: Optional[TemplateFormat] = None,
) -> ContentPartTemplate:
    """Factory function to create appropriate ContentPartTemplate from a dict.

    Args:
        content_part: Dictionary with 'type' key and type-specific content.
        format: Optional format specification for templating.

    Returns:
        ContentPartTemplate: Appropriate subclass instance.

    Raises:
        ValueError: If content type is unsupported or required fields are missing.

    Examples:
        >>> create_content_part_template({"type": "text", "text": "Hello {{name}}"})
        TextContentPartTemplate(...)

        >>> create_content_part_template({"type": "image_url", "image_url": {"url": "..."}})
        ImageUrlContentPartTemplate(...)
    """
    if "type" not in content_part:
        raise ValueError("Content part must have a 'type' field")

    content_type = content_part["type"]

    if content_type == "text":
        # Support both 'text' and 'content' keys for flexibility
        text = content_part.get("text") or content_part.get("content")
        if not text:
            raise ValueError("Text content part must have 'text' or 'content' field")
        return TextContentPartTemplate(text=text, format=format)

    # elif content_type == "image_url":
    #     image_url = content_part.get("image_url")
    #     if not image_url:
    #         raise ValueError("Image content part must have 'image_url' field")
    #     return ImageUrlContentPartTemplate(image_url=image_url, format=format)

    else:
        raise ValueError(f"Unsupported content type: {content_type}")


class MessageTemplate:
    """Template for a single message with role and content.

    Handles both simple string content and structured content parts (text, image, etc.).
    Supports variable extraction and rendering across all content parts.
    """

    def __init__(
        self,
        role: Union[MessageRole, str],
        content: Union[str, List[Dict[str, Any]]],
        format: Optional[TemplateFormat] = None,
    ):
        """Initialize a message template.

        Args:
            role: The role of the message (system, user, or assistant).
            content: Either a string or a list of content part dictionaries.
            format: Optional format specification for templating.

        Raises:
            ValueError: If role is invalid or content is empty.
            TypeError: If content is not str or list.
        """
        # Convert string to MessageRole if needed
        if isinstance(role, MessageRole):
            self.role = role
        elif isinstance(role, str):
            try:
                self.role = MessageRole(role)
            except ValueError:
                raise ValueError(
                    f"Invalid role: {role}. Must be one of: {[r.value for r in MessageRole]}"
                )

        self._format = format
        self._original_content = content  # Store original for content property

        # Handle string content
        if isinstance(content, str):
            if not content:
                raise ValueError("Content cannot be empty")
            # gets converted back to string in render step
            self._content_templates: List[ContentPartTemplate] = [
                TextContentPartTemplate(text=content, format=format)
            ]
            self._is_string_content = True

        # Handle list of content parts
        elif isinstance(content, list):
            if not content:
                raise ValueError("Content list cannot be empty")

            self._content_templates = [
                create_content_part_template(part, format) for part in content
            ]
            self._is_string_content = False

        else:
            raise TypeError(f"Content must be str or list, got {type(content).__name__}")

    @property
    def content(self) -> Union[str, List[Dict[str, Any]]]:
        """Get the original content in its input format.

        Returns:
            The content as originally provided (str or List[Dict]).
        """
        return self._original_content

    def variables(self) -> List[str]:
        """Extract all variables from the message content.

        Returns:
            List[str]: Unique list of variable names found across all content parts.
        """
        variables_set: set[str] = set()
        for template in self._content_templates:
            variables_set.update(template.variables())
        return list(variables_set)

    def render(self, variables: Dict[str, Any]) -> Message:
        """Render the message template with the given variables.

        Args:
            variables: The variables to substitute into the template.

        Returns:
            Message: A rendered message TypedDict with role and content.
            Content will be a string if the original input was a string,
            or a list of ContentPart if the original input was a list.
        """
        # For simple string content, return as string
        if self._is_string_content:
            rendered_part = cast(TextContentPart, self._content_templates[0].render(variables))
            return Message(role=self.role, content=rendered_part["text"])

        # For multiple content parts, return as list
        rendered_parts: List[ContentPart] = [
            template.render(variables) for template in self._content_templates
        ]
        return Message(role=self.role, content=rendered_parts)


class Template:
    """
    Template for rendering prompts with mustache ({{variable}}) or f-string ({variable}) formats.

    Supports auto-detection of template format and handles JSON content correctly.

    .. deprecated::
        Template is deprecated. Use PromptTemplate instead, which supports both string
        templates and message lists (OpenAI-style format).
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
        warnings.warn(
            "Template is deprecated and will be removed in a future version. "
            "Use PromptTemplate instead, which supports both string templates and "
            "message lists (OpenAI-style format).",
            DeprecationWarning,
            stacklevel=2,
        )
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
    - Structured content parts (text, image_url, etc.) within messages

    Format detection is delegated to individual content parts, allowing mixed formats
    within a single template (e.g., one message with mustache, another with f-string).
    """

    _template: PromptLike
    _messages: List[MessageTemplate]
    _is_string: bool
    _variables: List[str]
    template_format: Optional[TemplateFormat]

    def __init__(
        self,
        *,
        template: Union[PromptLike, "PromptTemplate", Template],
        template_format: Optional[TemplateFormat] = None,
    ):
        """Initialize a PromptTemplate instance.

        Args:
            template: Either a string template, a list of message dicts with role and content,
                a Template instance, or another PromptTemplate instance (which will be copied).
            template_format: Optional format specification (F_STRING or MUSTACHE).
                If None, format will be auto-detected by each content part independently.
                If specified, forces all content parts to use the same format.
                When copying from another PromptTemplate, this overrides the original format.

        Raises:
            ValueError: If the template is empty or messages are invalid.
            TypeError: If template is not a valid type.
        """
        # Handle PromptTemplate instances by copying their internal state
        if isinstance(template, PromptTemplate):
            self._template = template._template
            self._messages = template._messages
            self._is_string = template._is_string
            self._variables = template._variables
            # Use provided template_format if given, otherwise preserve original
            self.template_format = (
                template_format if template_format is not None else template.template_format
            )
            return

        self.template_format = template_format

        if isinstance(template, Template):
            self._template = template.template
            self._variables = template.variables
            self._messages = [
                MessageTemplate(
                    role=MessageRole.USER,
                    content=template.template,
                    format=template.template_format,
                )
            ]
            self._is_string = True
        elif isinstance(template, str):
            if not template:
                raise ValueError("Template cannot be empty")
            self._is_string = True
            self._template = template

            # Create a single user message template - it will handle format detection
            self._messages = [
                MessageTemplate(role=MessageRole.USER, content=template, format=template_format)
            ]

            # Extract variables from the MessageTemplate
            self._variables = self._messages[0].variables()

        elif isinstance(template, list):
            if not template:
                raise ValueError("Template list cannot be empty")

            self._is_string = False
            self._template = template

            # Validate and create MessageTemplate instances
            self._messages = []
            for i, msg in enumerate(template):
                if not isinstance(msg, dict):
                    raise TypeError(f"Message {i} must be a dict, got {type(msg)}")
                if "role" not in msg:
                    raise ValueError(f"Message {i} must have a 'role' field")
                if "content" not in msg:
                    raise ValueError(f"Message {i} must have a 'content' field")

                self._messages.append(
                    MessageTemplate(
                        role=msg["role"], content=msg["content"], format=template_format
                    )
                )

            # Extract variables from all messages
            variables_set: set[str] = set()
            for msg_template in self._messages:
                variables_set.update(msg_template.variables())
            self._variables = list(variables_set)

        else:
            raise TypeError(f"Template must be str or list, got {type(template)}")

    @property
    def template(self) -> PromptLike:
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

    def render(self, variables: Dict[str, Any], tracer: Optional[Tracer] = None) -> List[Message]:
        """Render the template with the given variables.

        Args:
            variables: The variables to substitute into the template.
            tracer: Optional tracer for tracing operations.

        Returns:
            List of rendered Message TypedDicts. String templates are converted
            to a single user message.

        Raises:
            TypeError: If variables is not a dictionary.
        """
        if not isinstance(variables, dict):  # pyright: ignore
            raise TypeError(f"Variables must be a dictionary, got {type(variables)}")

        # Render all messages using MessageTemplate instances
        rendered_messages: List[Message] = []
        for msg_template in self._messages:
            rendered_msg = msg_template.render(variables)
            # Apply dedent to string content
            if isinstance(rendered_msg["content"], str):
                rendered_msg = Message(
                    role=rendered_msg["role"], content=dedent(rendered_msg["content"])
                )
            rendered_messages.append(rendered_msg)
        return rendered_messages
