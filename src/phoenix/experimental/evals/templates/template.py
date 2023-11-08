import re
from typing import Any, Dict, List, Tuple, Union

import pandas as pd

from ..utils.types import is_list_of

DEFAULT_START_DELIM = "{"
DEFAULT_END_DELIM = "}"

# Rather than returning None, we return this string to indicate that the LLM output could not be
# parsed.
# This is useful for debugging as well as to just treat the output as a non-parsable category
NOT_PARSABLE = "NOT_PARSABLE"


class PromptTemplate:
    text: str
    variables: List[str]

    def __init__(
        self,
        rails: Dict[bool, str],
        base_template: str,
        explanation_template: str,
        delimiters: List[str] = [DEFAULT_START_DELIM, DEFAULT_END_DELIM],
    ):
        self.rails = rails
        self.base_template = base_template
        self.explanation_template = explanation_template
        self._start_delim, self._end_delim = self._get_delimiters(delimiters)
        self.variables = []
        for text in [base_template, explanation_template]:
            self._validate(text)
            self.variables += self._parse_variables(text)

    def prompt(self, provide_explanation: bool) -> str:
        if provide_explanation:
            return self.explanation_template
        else:
            return self.base_template

    def format(self, variable_values: Dict[str, Union[bool, int, float, str]], **options) -> str:
        prompt = self.prompt(**options)
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

    def _validate(self, text) -> None:
        # Validate that for every open delimiter, we have the corresponding closing one
        start_count = text.count(self._start_delim)
        end_count = text.count(self._end_delim)
        if start_count != end_count:
            raise ValueError(
                f"text poorly formatted. Found {start_count} instances of delimiter "
                f"{self._start_delim} and {end_count} instances of {self._end_delim}. "
                "They must be equal to be correctly paired."
            )

    def _parse_variables(self, text) -> List[str]:
        pattern = re.escape(self._start_delim) + "(.*?)" + re.escape(self._end_delim)
        variables = re.findall(pattern, text)
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


def map_template(
    dataframe: pd.DataFrame, template: PromptTemplate, **options: Any
) -> "pd.Series[str]":
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
                variable_values={var_name: row[var_name] for var_name in template.variables},
                **options,
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
