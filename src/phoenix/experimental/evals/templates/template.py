import logging
import re
from dataclasses import dataclass
from string import Formatter
from typing import Dict, List, Optional, Sequence, Tuple, Union, cast

from ..utils.types import is_list_of

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())

DEFAULT_START_DELIM = "{"
DEFAULT_END_DELIM = "}"


@dataclass
class PromptTemplate:
    text: str
    variables: List[str]

    def __init__(
        self,
        text: str,
        delimiters: List[str] = [DEFAULT_START_DELIM, DEFAULT_END_DELIM],
        rails: Optional[Sequence[str]] = None,
    ):
        self.text = text
        self._start_delim, self._end_delim = self._get_delimiters(delimiters)
        self._validate()
        self.variables = self._parse_variables()
        self.rails = rails or _deduce_binary_rails(text)

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


def _deduce_binary_rails(text: str) -> Tuple[str, str]:
    match = re.search(_rails_pattern, text)
    if match is not None:
        rails = cast(Tuple[str, str], match.groups())
        logger.info(f"deducing binary rails from text: {', '.join(rails)}")
        return rails
    raise ValueError(
        "binary rails cannot be deduced from text. rails must be specified at initialization"
    )


_rails_pattern = re.compile(
    r"""response +(?:should|must|shall|has +to|needs +to) +be\b.*?[`"'](\w+)[`"'] +or +[`"'](\w+)[`"']""",  # noqa: E501
    re.IGNORECASE,
)
