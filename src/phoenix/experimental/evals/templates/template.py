import json
import re
from dataclasses import dataclass
from typing import Callable, List, Mapping, Optional, Tuple, Union

import pandas as pd

from phoenix.utilities.logging import printif

DEFAULT_START_DELIM = "{"
DEFAULT_END_DELIM = "}"

# Rather than returning None, we return this string to indicate that the LLM output could not be
# parsed.
# This is useful for debugging as well as to just treat the output as a non-parsable category
NOT_PARSABLE = "NOT_PARSABLE"

# argument keys in the default openai function call,
# defined here only to prevent typos
_RESPONSE = "response"
_EXPLANATION = "explanation"


@dataclass
class PromptOptions:
    provide_explanation: bool = False


class PromptTemplate:
    template: str
    variables: List[str]

    def __init__(
        self,
        template: str,
        delimiters: Tuple[str, str] = (DEFAULT_START_DELIM, DEFAULT_END_DELIM),
    ):
        self.template = template
        self._start_delim, self._end_delim = delimiters
        self.variables = self._parse_variables(self.template)

    def prompt(self, options: Optional[PromptOptions] = None) -> str:
        return self.template

    def format(
        self,
        variable_values: Mapping[str, Union[bool, int, float, str]],
        options: Optional[PromptOptions] = None,
    ) -> str:
        prompt = self.prompt(options)
        for variable_name in self.variables:
            prompt = prompt.replace(
                self._start_delim + variable_name + self._end_delim,
                str(variable_values[variable_name]),
            )
        return prompt

    def _parse_variables(self, text: str) -> List[str]:
        pattern = re.escape(self._start_delim) + "(.*?)" + re.escape(self._end_delim)
        variables = re.findall(pattern, text)
        return variables


class ClassificationTemplate(PromptTemplate):
    def __init__(
        self,
        rails: List[str],
        template: str,
        explanation_template: Optional[str] = None,
        label_parser: Optional[Callable[[str], str]] = None,
        explanation_label_parser: Optional[Callable[[str], str]] = None,
        delimiters: Tuple[str, str] = (DEFAULT_START_DELIM, DEFAULT_END_DELIM),
    ):
        self.rails = rails
        self.template = template
        self.explanation_template = explanation_template
        self.label_parser = label_parser
        self.explanation_label_parser = explanation_label_parser
        self._start_delim, self._end_delim = delimiters
        self.variables: List[str] = []
        for text in [template, explanation_template]:
            if text is not None:
                self.variables += self._parse_variables(text)

    def __repr__(self) -> str:
        return self.template

    def prompt(self, options: Optional[PromptOptions] = None) -> str:
        if options is None:
            return self.template

        if options.provide_explanation and self.explanation_template:
            return self.explanation_template
        else:
            return self.template

    def parse_output(
        self,
        unparsed_output: str,
        use_openai_function_call: bool,
        provide_explanation: bool,
        verbose: bool,
    ) -> Tuple[str, Optional[str]]:
        if not use_openai_function_call:
            if provide_explanation:
                unrailed_label, explanation = (
                    self.extract_label_from_explanation(unparsed_output),
                    unparsed_output,
                )
                printif(
                    verbose and unrailed_label == NOT_PARSABLE,
                    f"- Could not parse {repr(unparsed_output)}",
                )
            else:
                unrailed_label = unparsed_output
                explanation = None
        else:
            try:
                function_arguments = json.loads(unparsed_output, strict=False)
                unrailed_label = function_arguments.get(_RESPONSE)
                explanation = function_arguments.get(_EXPLANATION)
            except json.JSONDecodeError:
                unrailed_label = unparsed_output
                explanation = None
        return _snap_to_rail(unrailed_label, self.rails, verbose=verbose), explanation

    def extract_label_from_explanation(self, raw_string: str) -> str:
        if parser := self.explanation_label_parser:
            return parser(raw_string)
        return parse_label_from_chain_of_thought_response(raw_string)


def parse_label_from_chain_of_thought_response(raw_string: str) -> str:
    label_delimiter = r"\W*label\W*"
    parts = re.split(label_delimiter, raw_string, maxsplit=1, flags=re.IGNORECASE)
    if len(parts) == 2:
        return parts[1]
    return NOT_PARSABLE


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
) -> "pd.Series[str]":
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
        prompts = dataframe.apply(
            lambda row: template.format(
                variable_values={var_name: row[var_name] for var_name in template.variables},
                options=prompt_options,
            ),
            axis=1,
        )
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


def _snap_to_rail(raw_string: Optional[str], rails: List[str], verbose: bool = False) -> str:
    """
    Snaps a string to the nearest rail, or returns None if the string cannot be
    snapped to a rail.

    Args:
        raw_string (str): An input to be snapped to a rail.

        rails (List[str]): The target set of strings to snap to.

    Returns:
        str: A string from the rails argument or "UNPARSABLE" if the input
        string could not be snapped.
    """
    if not raw_string:
        return NOT_PARSABLE
    snap_string = raw_string.lower()
    rails = list(set(rail.lower() for rail in rails))
    rails.sort(key=len, reverse=True)
    found_rails = set()
    for rail in rails:
        if rail in snap_string:
            found_rails.add(rail)
            snap_string = snap_string.replace(rail, "")
    if len(found_rails) != 1:
        printif(verbose, f"- Cannot snap {repr(raw_string)} to rails")
        return NOT_PARSABLE
    rail = list(found_rails)[0]
    printif(verbose, f"- Snapped {repr(raw_string)} to rail: {rail}")
    return rail
