import re
from string import Formatter
from typing import Any, Literal, Set

from typing_extensions import assert_never

PATTERN = re.compile(r"{{\s*(\w+)\s*}}")


class TemplateFormatter:
    def __init__(self, template: str, template_language: Literal["mustache", "f-string"]) -> None:
        self._template = template
        self._template_language = template_language

    def parse(self, template: str) -> Set[str]:
        if self._template_language == "mustache":
            return set(match for match in re.findall(PATTERN, template))
        if self._template_language == "f-string":
            return set(
                field_name for _, field_name, _, _ in Formatter().parse(template) if field_name
            )
        assert_never(self._template_language)

    def format(self, **kwargs: Any) -> str:
        template_variable_names = self.parse(self._template)
        if missing_template_variables := template_variable_names - set(kwargs.keys()):
            raise ValueError(f"Missing template variables: {', '.join(missing_template_variables)}")
        if self._template_language == "mustache":
            template = self._template
            for template_variable_name in template_variable_names:
                template = re.sub(
                    rf"{{{{\s*{template_variable_name}\s*}}}}",
                    kwargs[template_variable_name],
                    template,
                )
            return template
        if self._template_language == "f-string":
            return self._template.format(**kwargs)
        assert_never(self._template_language)
