import re
import string
from abc import ABC, abstractmethod
from collections.abc import Iterable
from types import MappingProxyType
from typing import Any, Mapping, Protocol

from typing_extensions import assert_never

from phoenix.client.__generated__ import v1


class TemplateFormatter(Protocol):
    def format(
        self,
        template: str,
        /,
        *,
        variables: Mapping[str, str],
    ) -> str: ...


class BaseTemplateFormatter(ABC):
    @abstractmethod
    def parse(self, template: str) -> set[str]:
        """
        Parse the template and return a set of variable names.
        """
        raise NotImplementedError

    def format(
        self,
        template: str,
        /,
        *,
        variables: Mapping[str, str] = MappingProxyType({}),
    ) -> str:
        """
        Formats the template with the given variables.
        """
        template_variable_names = self.parse(template)
        if missing_template_variables := template_variable_names - set(variables.keys()):
            raise TemplateFormatterError(
                f"Missing template variable(s): {', '.join(missing_template_variables)}"
            )
        return self._format(template, template_variable_names, variables)

    @abstractmethod
    def _format(
        self,
        template: str,
        variable_names: Iterable[str],
        variables: Mapping[str, str] = MappingProxyType({}),
    ) -> str:
        raise NotImplementedError


class NoOpFormatterBase(BaseTemplateFormatter):
    """
    No-op template formatter.

    Examples:

    >>> formatter = NoOpFormatterBase()
    >>> formatter.format("hello")
    'hello'
    """

    def parse(self, template: str) -> set[str]:
        return set()

    def _format(self, template: str, *args: Any, **kwargs: Any) -> str:
        return template


class FStringBaseTemplateFormatter(BaseTemplateFormatter):
    """
    Regular f-string template formatter.

    Examples:

    >>> formatter = FStringBaseTemplateFormatter()
    >>> formatter.format("{hello}", {"hello": "world"})
    'world'
    """

    def parse(self, template: str) -> set[str]:
        return set(
            field_name for _, field_name, _, _ in string.Formatter().parse(template) if field_name
        )

    def _format(
        self,
        template: str,
        variable_names: Iterable[str],
        variables: Mapping[str, str] = MappingProxyType({}),
    ) -> str:
        return template.format(**variables)


class MustacheBaseTemplateFormatter(BaseTemplateFormatter):
    """
    Mustache template formatter.

    Examples:

    >>> formatter = MustacheBaseTemplateFormatter()
    >>> formatter.format("{{ hello }}", {"hello": "world"})
    'world'
    """

    PATTERN = re.compile(r"(?<!\\){{\s*(\w+)\s*}}")

    def parse(self, template: str) -> set[str]:
        return set(match for match in re.findall(self.PATTERN, template))

    def _format(
        self,
        template: str,
        variable_names: Iterable[str],
        variables: Mapping[str, str] = MappingProxyType({}),
    ) -> str:
        for variable_name in variable_names:
            pattern = rf"(?<!\\){{{{\s*{re.escape(variable_name)}\s*}}}}"
            replacement = variables[variable_name]
            template = re.sub(
                pattern=pattern,
                repl=lambda _: replacement,
                string=template,
            )
        return template


class TemplateFormatterError(Exception):
    """
    An error raised when template formatting fails.
    """

    pass


F_STRING_TEMPLATE_FORMATTER = FStringBaseTemplateFormatter()
MUSTACHE_TEMPLATE_FORMATTER = MustacheBaseTemplateFormatter()
NO_OP_FORMATTER = NoOpFormatterBase()


def to_formatter(obj: v1.PromptVersionData) -> BaseTemplateFormatter:
    if (
        "template_format" not in obj
        or not obj["template_format"]
        or obj["template_format"] == "MUSTACHE"
    ):
        return MUSTACHE_TEMPLATE_FORMATTER
    elif obj["template_format"] == "F_STRING":
        return F_STRING_TEMPLATE_FORMATTER
    elif obj["template_format"] == "NONE":
        return NO_OP_FORMATTER
    else:
        assert_never(obj["template_format"])
