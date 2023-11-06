from dataclasses import dataclass
from string import Formatter
from typing import Dict, List, Tuple, Union

import pandas as pd

from ..utils.types import is_list_of

DEFAULT_START_DELIM = "{"
DEFAULT_END_DELIM = "}"

# Rather than returning None, we return this string to indicate that the LLM output could not be
# parsed.
# This is useful for debugging as well as to just treat the output as a non-parsable category
NOT_PARSABLE = "NOT_PARSABLE"


@dataclass
class PromptTemplate:
    text: str
    variables: List[str]

    def __init__(self, text: str, delimiters: List[str] = [DEFAULT_START_DELIM, DEFAULT_END_DELIM]):
        self.text = text
        self._start_delim, self._end_delim = self._get_delimiters(delimiters)
        self._validate()
        self.variables = self._parse_variables()

    def format(self, variable_values: Dict[str, Union[bool, int, float, str]]) -> str:
        prompt = self.text
        for variable_name in self.variables:
            prompt = prompt.replace(
                self._start_delim + variable_name + self._end_delim,
                str(variable_values[variable_name]),
            )
        return prompt

    def _get_delimiters(self, delimiters: List[str]) -> Tuple[str, str]:
        if not is_list_of(delimiters, str):
            raise TypeError("delimiters must be a list of strings")
        if len(delimiters) == 1:
            return delimiters[0], delimiters[0]
        elif len(delimiters) == 2:
            return delimiters[0], delimiters[1]
        else:
            raise ValueError("delimiters must only contain 2 items in the list")

    def _validate(self) -> None:
        # Validate that for every open delimiter, we have the corresponding closing one
        start_count = self.text.count(self._start_delim)
        end_count = self.text.count(self._end_delim)
        if start_count != end_count:
            raise ValueError(
                f"text poorly formatted. Found {start_count} instances of delimiter "
                f"{self._start_delim} and {end_count} instances of {self._end_delim}. "
                "They must be equal to be correctly paired."
            )

    def _parse_variables(self) -> List[str]:
        variables = []
        formatter = Formatter()

        text = self.text

        # Example of this could be a template like: My name is ::name::
        if self._start_delim == self._end_delim:
            delim_length = len(self._start_delim)
            delim_count = text.count(self._start_delim)
            while delim_count > 0:
                left_index = text.find(self._start_delim)
                right_index = text[left_index + delim_length :].find(self._start_delim)
                text = (
                    text[0:left_index]
                    + DEFAULT_START_DELIM
                    + text[left_index + delim_length : left_index + delim_length + right_index]
                    + DEFAULT_END_DELIM
                    + text[left_index + 2 * delim_length + right_index :]
                )
                delim_count = text.count(self._start_delim)
        else:
            if self._start_delim != "{":
                text = text.replace(self._start_delim, DEFAULT_START_DELIM)
            if self._end_delim != "{":
                text = text.replace(self._end_delim, DEFAULT_END_DELIM)

        for _, variable_name, _, _ in formatter.parse(text):
            if variable_name:
                variables.append(variable_name)

        return variables


def normalize_template(template: Union[PromptTemplate, str]) -> PromptTemplate:
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
        return PromptTemplate(text=template)

    raise TypeError(
        "Invalid type for argument `template`. Expected a string or PromptTemplate "
        f"but found {type(template)}."
    )


def map_template(dataframe: pd.DataFrame, template: PromptTemplate) -> "pd.Series[str]":
    """
    Maps over a dataframe to construct a list of prompts from a template and a dataframe.
    """
    # Was considering to construct the prompts and generate answers concurrently. However,
    # if there's errors in the prompt construction it could interrupt the process and we
    # would've used API credits for nothing. We could solve this problem by streaming the
    # answers so that, if there is an error, we keep the answers obtained up to that point.
    # These are out of scope for M0, but good to keep in mind and consider for the future.
    try:
        prompts = dataframe.apply(
            lambda row: template.format(
                variable_values={var_name: row[var_name] for var_name in template.variables}
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
