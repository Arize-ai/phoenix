import re
from collections import OrderedDict
from dataclasses import dataclass
from enum import Enum
from string import Formatter
from typing import Any, Callable, List, Mapping, Optional, Sequence, Tuple, Union

import pandas as pd

from phoenix.evals.exceptions import PhoenixException

DEFAULT_START_DELIM = "{"
DEFAULT_END_DELIM = "}"


@dataclass
class PromptOptions:
    provide_explanation: bool = False


class InvalidClassificationTemplateError(PhoenixException):
    pass


class DotKeyFormatter(Formatter):
    def get_field(self, field_name: str, args: Sequence[Any], kwargs: Mapping[str, Any]) -> Any:
        # Treat the entire field_name as a single key without splitting at dots
        obj = self.get_value(field_name, args, kwargs)
        return obj, field_name


class PromptPartContentType(str, Enum):
    TEXT = "text"
    AUDIO = "audio"
    IMAGE = "image"


@dataclass
class PromptPart:
    content_type: PromptPartContentType
    content: str


# TODO: ask about rename to PromptTemplatePart
@dataclass
class PromptPartTemplate:
    content_type: PromptPartContentType
    template: str


@dataclass
class MultimodalPrompt:
    parts: List[PromptPart]

    @staticmethod
    def from_string(string_prompt: str) -> "MultimodalPrompt":
        return MultimodalPrompt(
            parts=[PromptPart(content_type=PromptPartContentType.TEXT, content=string_prompt)]
        )

    def to_text_only_prompt(self) -> str:
        if any(part.content_type != PromptPartContentType.TEXT for part in self.parts):
            raise ValueError("This model does not support multimodal prompts")

        return "\n\n".join(
            [part.content for part in self.parts if part.content_type == PromptPartContentType.TEXT]
        )

    def __str__(self) -> str:
        return "\n\n".join([part.content for part in self.parts])


class PromptTemplate:
    template: List[PromptPartTemplate]
    variables: List[str]

    def __init__(
        self,
        template: Union[str, List[PromptPartTemplate]],
        delimiters: Tuple[str, str] = (DEFAULT_START_DELIM, DEFAULT_END_DELIM),
    ):
        self.template: List[PromptPartTemplate] = self._normalize_template(template)
        self._start_delim, self._end_delim = delimiters
        self.variables = self._parse_variables(self.template)

    def prompt(self, options: Optional[PromptOptions] = None) -> List[PromptPartTemplate]:
        return self.template

    def format(
        self,
        variable_values: Mapping[str, Union[bool, int, float, str]],
        options: Optional[PromptOptions] = None,
    ) -> MultimodalPrompt:
        prompt = self.prompt(options)
        prompt_messages = []
        for template_message in prompt:
            prompt_message = template_message.template

            if self._start_delim == "{" and self._end_delim == "}":
                self.formatter = DotKeyFormatter()
                prompt_message = self.formatter.format(prompt_message, **variable_values)
            else:
                for variable_name in self.variables:
                    prompt_message = prompt_message.replace(
                        self._start_delim + variable_name + self._end_delim,
                        str(variable_values[variable_name]),
                    )
            prompt_messages.append(
                PromptPart(content_type=template_message.content_type, content=prompt_message)
            )
        return MultimodalPrompt(parts=prompt_messages)

    def _parse_variables(self, template: List[PromptPartTemplate]) -> List[str]:
        start = re.escape(self._start_delim)
        end = re.escape(self._end_delim)
        pattern = rf"{start}(.*?){end}"
        variables = []
        for template_message in template:
            variables += re.findall(pattern, template_message.template)
        return variables

    def _normalize_template(
        self, template: Union[str, List[PromptPartTemplate]]
    ) -> List[PromptPartTemplate]:
        if isinstance(template, str):
            return [PromptPartTemplate(content_type=PromptPartContentType.TEXT, template=template)]
        return template


class ClassificationTemplate(PromptTemplate):
    def __init__(
        self,
        rails: List[str],
        template: Union[str, List[PromptPartTemplate]],
        explanation_template: Optional[Union[str, List[PromptPartTemplate]]] = None,
        explanation_label_parser: Optional[Callable[[str], str]] = None,
        delimiters: Tuple[str, str] = (DEFAULT_START_DELIM, DEFAULT_END_DELIM),
        scores: Optional[List[float]] = None,
    ):
        if scores is not None and len(rails) != len(scores):
            raise InvalidClassificationTemplateError(
                "If scores are provided, each rail must have one and only one score "
                "(i.e., the length of both lists must be the same)."
            )
        self.rails = rails
        self.template = self._normalize_template(template)
        self.explanation_template: Optional[List[PromptPartTemplate]]
        if explanation_template:
            self.explanation_template = self._normalize_template(explanation_template)
        else:
            self.explanation_template = None
        self.explanation_label_parser = explanation_label_parser
        self._start_delim, self._end_delim = delimiters
        self.variables: List[str] = []
        for _template in [self.template, self.explanation_template]:
            if _template:
                self.variables.extend(self._parse_variables(template=_template))
            # remove duplicates while preserving order
            self.variables = list(OrderedDict.fromkeys(self.variables))

        self._scores = scores

    def __repr__(self) -> str:
        return "\n\n".join([template.template for template in self.template])

    def prompt(self, options: Optional[PromptOptions] = None) -> List[PromptPartTemplate]:
        if options is None:
            return self.template

        if options.provide_explanation and self.explanation_template:
            return self.explanation_template
        else:
            return self.template

    def extract_label_from_explanation(self, raw_string: str) -> str:
        if parser := self.explanation_label_parser:
            return parser(raw_string)
        return parse_label_from_chain_of_thought_response(raw_string)

    def score(self, rail: str) -> float:
        if self._scores is None:
            return 0.0
        try:
            return self._scores[self.rails.index(rail)]
        except (IndexError, ValueError):
            return 0.0


def parse_label_from_chain_of_thought_response(raw_string: str) -> str:
    label_delimiter = r"\W*label\W*"
    parts = re.split(label_delimiter, raw_string, maxsplit=1, flags=re.IGNORECASE)
    if len(parts) == 2:
        return parts[1]
    return raw_string  # Fallback to the whole string if no label delimiter is found


def normalize_classification_template(
    rails: List[str], template: Union[PromptTemplate, ClassificationTemplate, str]
) -> ClassificationTemplate:
    """
    Normalizes a template to a ClassificationTemplate object.
    Args:
        template (Union[ClassificationTemplate, str]): The template to be normalized.
    Returns:
        ClassificationTemplate: The normalized template.
    """
    if isinstance(template, ClassificationTemplate):
        return template

    if isinstance(template, PromptTemplate):
        return ClassificationTemplate(rails=rails, template=template.template)

    if isinstance(template, str):
        return ClassificationTemplate(rails=rails, template=template)

    raise TypeError(
        "Invalid type for argument `template`. Expected a string or ClassificationTemplate "
        f"but found {type(template)}."
    )


def normalize_prompt_template(template: Union[PromptTemplate, str]) -> PromptTemplate:
    """
    Normalizes a template to a PromptTemplate object.
    Args:
        template (Union[PromptTemplate, str]): The template to be normalized.
    Returns:
        PromptTemplate: The normalized template.
    """
    if isinstance(template, PromptTemplate):
        return template

    if isinstance(template, str):
        return PromptTemplate(template=template)

    raise TypeError(
        "Invalid type for argument `template`. Expected a string or PromptTemplate "
        f"but found {type(template)}."
    )


def map_template(
    dataframe: pd.DataFrame,
    template: PromptTemplate,
    options: Optional[PromptOptions] = None,
) -> List[MultimodalPrompt]:
    """
    Maps over a dataframe to construct a list of prompts from a template and a dataframe.
    """
    # Was considering to construct the prompts and generate answers concurrently. However,
    # if there's errors in the prompt construction it could interrupt the process and we
    # would've used API credits for nothing. We could solve this problem by streaming the
    # answers so that, if there is an error, we keep the answers obtained up to that point.
    # These are out of scope for M0, but good to keep in mind and consider for the future.
    prompt_options: PromptOptions = PromptOptions() if options is None else options

    try:
        prompts = [
            template.format(
                variable_values={var_name: row[var_name] for var_name in template.variables},
                options=prompt_options,
            )
            for _, row in dataframe.iterrows()
        ]
        return prompts
    except KeyError as e:
        raise RuntimeError(
            f"Error while constructing the prompts from the template and dataframe. "
            f"The template variable {e} is not found as a column in the dataframe."
        )
    except Exception as e:
        raise RuntimeError(
            f"Error while constructing the prompts from the template and dataframe variables: {e}."
        )
