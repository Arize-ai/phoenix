from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional, TypedDict, Union


class TemplateFormat(str, Enum):
    MUSTACHE = "mustache"
    F_STRING = "f_string"
    JINJA2 = "jinja2"


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
            import pystache

            return pystache.render(template, variables)
        except ImportError:
            result = template
            for key, value in variables.items():
                result = result.replace(f"{{{{{key}}}}}", str(value))
            return result

    def extract_variables(self, template: str) -> List[str]:
        try:
            import pystache

            parsed = pystache.parse(template)
            variables = []
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


class FStringFormatter(TemplateFormatter):
    def render(self, template: str, variables: Dict[str, Any]) -> str:
        try:
            from phoenix.evals.templates import DotKeyFormatter

            formatter = DotKeyFormatter()
            return formatter.format(template, **variables)
        except ImportError:
            return template.format(**variables)

    def extract_variables(self, template: str) -> List[str]:
        import re

        pattern = r"\{([^}]+)\}"
        return [match.strip() for match in re.findall(pattern, template)]


class Jinja2Formatter(TemplateFormatter):
    def render(self, template: str, variables: Dict[str, Any]) -> str:
        try:
            import jinja2

            template_obj = jinja2.Template(template)
            return template_obj.render(**variables)
        except ImportError:
            return MustacheFormatter().render(template, variables)

    def extract_variables(self, template: str) -> List[str]:
        try:
            import jinja2
            from jinja2 import meta

            env = jinja2.Environment()
            ast = env.parse(template)
            return list(meta.find_undeclared_variables(ast))
        except ImportError:
            return MustacheFormatter().extract_variables(template)


class FormatterFactory:
    _formatters = {
        TemplateFormat.MUSTACHE: MustacheFormatter,
        TemplateFormat.F_STRING: FStringFormatter,
        TemplateFormat.JINJA2: Jinja2Formatter,
    }

    @classmethod
    def create(cls, format_type: TemplateFormat) -> TemplateFormatter:
        formatter_class = cls._formatters.get(format_type)
        if not formatter_class:
            raise ValueError(f"Unsupported template format: {format_type}")
        return formatter_class()


class EvalTemplate:
    """
    A template for LLM evaluation that renders prompts and generates JSON schemas.

    This class provides a simple interface for creating evaluation templates that work
    directly with LLM.generate_object() methods. It supports multiple template formats
    and can generate structured output schemas for classification tasks.

    Args:
        template: Template string with variables (e.g., "Classify: {{text}}")
        labels: Classification labels as strings or string->description mapping
        template_format: Template format (MUSTACHE, F_STRING, or JINJA2)
        include_explanation: Whether to require explanations in output

    Examples:
        Basic string labels:
        >>> template = EvalTemplate(
        ...     template="Classify sentiment: {{text}}",
        ...     labels=["positive", "negative", "neutral"]
        ... )
        >>> result = template.render({"text": "Great product!"})
        >>> llm.generate_object(result["prompt"], result["schema"])

        Labels with descriptions:
        >>> template = EvalTemplate(
        ...     template="Rate quality: {{response}}",
        ...     labels={
        ...         "excellent": "High quality response",
        ...         "good": "Adequate response",
        ...         "poor": "Low quality response"
        ...     }
        ... )

        >>> template = EvalTemplate(
        ...     template="Classify: {{text}}",
        ...     labels=["spam", "not_spam"],
        ...     include_explanation=True
        ... )
        >>> result = template.render({"text": "Buy now!"})
        >>> # Schema enforces [explanation, classification] order

        Different template formats:
        >>> # F-string format
        >>> template = EvalTemplate(
        ...     template="Classify: {text}",
        ...     labels=["positive", "negative"],
        ...     template_format=TemplateFormat.F_STRING
        ... )

        >>> # Jinja2 format
        >>> template = EvalTemplate(
        ...     template="{% if context %}Context: {{context}}{% endif %}\\nText: {{text}}",
        ...     labels=["relevant", "irrelevant"],
        ...     template_format=TemplateFormat.JINJA2
        ... )
    """

    def __init__(
        self,
        *,
        template: str,
        labels: Optional[Union[List[str], Dict[str, str]]] = None,
        template_format: TemplateFormat = TemplateFormat.MUSTACHE,
        include_explanation: bool = True,
    ):
        if not template:
            raise ValueError("Template cannot be empty")
        self.template = template
        self.labels = labels or []
        self.template_format = template_format
        self.include_explanation = include_explanation

        self._formatter = FormatterFactory.create(self.template_format)
        self._variables = self._formatter.extract_variables(self.template)
        self._label_names, self._label_descriptions = self._process_labels(self.labels)

    def _process_labels(
        self, labels: Union[List[str], Dict[str, str]]
    ) -> tuple[List[str], Dict[str, str]]:
        if not labels:
            return [], {}

        if isinstance(labels, list):
            return labels, {}

        if isinstance(labels, dict):
            return list(labels.keys()), labels

        raise TypeError(f"Unsupported label type: {type(labels)}")

    @property
    def variables(self) -> List[str]:
        return self._variables

    def render(self, variables: Dict[str, Any]) -> TemplateResult:
        if not isinstance(variables, dict):
            raise TypeError(f"Variables must be a dictionary, got {type(variables)}")
        rendered_prompt = self._formatter.render(self.template, variables)
        schema = self._generate_schema(variables)
        return TemplateResult(prompt=rendered_prompt, schema=schema)

    def _generate_schema(self, variables: Dict[str, Any]) -> Dict[str, Any]:
        if not self._label_names:
            return {}

        if self.include_explanation:
            classification_schema = {
                "type": "string",
                "enum": self._label_names,
                "description": "The classification result",
            }

            if self._label_descriptions:
                classification_schema["description"] += f". Options: {self._label_descriptions}"

            items = [
                {"type": "string", "description": "Explanation of the classification reasoning"},
                classification_schema,
            ]

            return {
                "type": "object",
                "properties": {
                    "response": {
                        "type": "array",
                        "items": items,
                        "minItems": len(items),
                        "maxItems": len(items),
                        "description": "Response as [explanation, classification]",
                    }
                },
                "required": ["response"],
                "additionalProperties": False,
            }
        else:
            classification_schema = {
                "type": "string",
                "enum": self._label_names,
                "description": "The classification result",
            }

            if self._label_descriptions:
                classification_schema["description"] += f". Options: {self._label_descriptions}"

            return {
                "type": "object",
                "properties": {"classification": classification_schema},
                "required": ["classification"],
                "additionalProperties": False,
            }

    def add_label(self, name: str, description: Optional[str] = None) -> None:
        if name not in self._label_names:
            self._label_names.append(name)
        if description:
            self._label_descriptions[name] = description
