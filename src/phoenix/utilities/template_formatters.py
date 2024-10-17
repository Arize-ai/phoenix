import re
from abc import ABC, abstractmethod
from string import Formatter
from typing import Any, Iterable, Set


class TemplateFormatter(ABC):
    @abstractmethod
    def parse(self, template: str) -> Set[str]:
        raise NotImplementedError

    def format(self, template: str, **kwargs: Any) -> str:
        template_variable_names = self.parse(template)
        if missing_template_variables := template_variable_names - set(kwargs.keys()):
            raise ValueError(f"Missing template variables: {', '.join(missing_template_variables)}")
        return self._format(template, template_variable_names, **kwargs)

    @abstractmethod
    def _format(self, template: str, variable_names: Iterable[str], **kwargs: Any) -> str:
        raise NotImplementedError


class FStringTemplateFormatter(TemplateFormatter):
    def parse(self, template: str) -> Set[str]:
        return set(field_name for _, field_name, _, _ in Formatter().parse(template) if field_name)

    def _format(self, template: str, variable_names: Iterable[str], **kwargs: Any) -> str:
        return template.format(**kwargs)


class MustacheTemplateFormatter(TemplateFormatter):
    PATTERN = re.compile(r"{{\s*(\w+)\s*}}")

    def parse(self, template: str) -> Set[str]:
        return set(match for match in re.findall(self.PATTERN, template))

    def _format(self, template: str, variable_names: Iterable[str], **kwargs: Any) -> str:
        variables = kwargs
        for variable_name in variable_names:
            template = re.sub(
                pattern=rf"{{{{\s*{variable_name}\s*}}}}",
                repl=variables[variable_name],
                string=template,
            )
        return template
