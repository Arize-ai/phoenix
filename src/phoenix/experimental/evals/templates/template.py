from dataclasses import dataclass
from string import Formatter
from typing import Dict, List, Tuple, Union

from ..utils.types import is_list_of

DEFAULT_START_DELIM = "{"
DEFAULT_END_DELIM = "}"


@dataclass
class PromptTemplate:
    template_str: str
    template_variables: List[str]

    def __init__(
        self, template_str: str, delimiters: List[str] = [DEFAULT_START_DELIM, DEFAULT_END_DELIM]
    ):
        self.template_str = template_str
        self._start_delim, self._end_delim = self._get_delimiters(delimiters)
        self._validate()
        self.template_variables = self._parse_variables()

    def format(self, variable_values: Dict[str, Union[bool, int, float, str]]) -> str:
        prompt = self.template_str
        for variable_name in self.template_variables:
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
        start_count = self.template_str.count(self._start_delim)
        end_count = self.template_str.count(self._end_delim)
        if start_count != end_count:
            raise ValueError(
                f"template_str poorly formatted. Found {start_count} instances of delimiter "
                f"{self._start_delim} and {end_count} instances of {self._end_delim}. "
                "They must be equal to be correctly paired."
            )

    def _parse_variables(self) -> List[str]:
        variables = []
        formatter = Formatter()

        template_str = self.template_str

        # Example of this could be a template like: My name is ::name::
        if self._start_delim == self._end_delim:
            delim_length = len(self._start_delim)
            delim_count = template_str.count(self._start_delim)
            while delim_count > 0:
                left_index = template_str.find(self._start_delim)
                right_index = template_str[left_index + delim_length :].find(self._start_delim)
                template_str = (
                    template_str[0:left_index]
                    + DEFAULT_START_DELIM
                    + template_str[
                        left_index + delim_length : left_index + delim_length + right_index
                    ]
                    + DEFAULT_END_DELIM
                    + template_str[left_index + 2 * delim_length + right_index :]
                )
                delim_count = template_str.count(self._start_delim)
        else:
            if self._start_delim != "{":
                template_str = template_str.replace(self._start_delim, DEFAULT_START_DELIM)
            if self._end_delim != "{":
                template_str = template_str.replace(self._end_delim, DEFAULT_END_DELIM)

        for _, variable_name, _, _ in formatter.parse(template_str):
            if variable_name:
                variables.append(variable_name)

        return variables
