import re
from typing import (
    List,
    Optional,
    Pattern,  # import from re module when we drop support for 3.8
    Union,
)

from pydantic import BaseModel, Field

from ..evaluators import EvalInput, Evaluator, Score


class MatchesRegex(Evaluator):
    """Evaluates whether text output matches a specified regular expression pattern.

    This code evaluator checks if the output contains one or more substrings that
    match a given regex pattern. It returns a binary score (1.0 for match, 0.0 for no match)
    along with an explanation of which substrings matched or that no match was found.

    Args:
        pattern: The regular expression pattern to match against. Can be provided as
            a string or a compiled Pattern object.
        name: Optional custom name for the evaluator. If not provided, defaults to
            "matches_regex".
        include_explanation: Whether to include an explanation in the Score object.
            Defaults to True.

    Examples:
        Basic usage with URL detection::

            import re
            from phoenix.evals.metrics.matches_regex import MatchesRegex

            # Compiled regex pattern
            pattern = re.compile(r"https?://[^\\s]+")
            contains_link = MatchesRegex(pattern=pattern)

            eval_input = {"output": "Check out https://github.com/Arize-ai/phoenix!"}

            scores = contains_link.evaluate(eval_input)
            print(scores)
            # [Score(name='matches_regex',
            #        score=1.0,
            #        label=None,
            #        explanation='There are 1 matches for the regex: https?://[^\\s]+',
            #        metadata={},
            #        kind='code',
            #        direction='maximize')]
    """

    class InputSchema(BaseModel):
        output: str = Field(
            ..., description="The text string to evaluate against the regex pattern."
        )

    def __init__(
        self,
        pattern: Union[str, Pattern[str]],
        name: Optional[str] = None,
        include_explanation: bool = True,
    ):
        if isinstance(pattern, str):
            self._raw_pattern = pattern
            pattern = re.compile(pattern)
        else:
            self._raw_pattern = pattern.pattern  # extract the original regex string

        self.pattern = pattern
        self.include_explanation = include_explanation
        eval_name = name or "matches_regex"

        super().__init__(
            name=eval_name,
            kind="code",
            input_schema=self.InputSchema,
            direction="maximize",
        )

    async def _async_evaluate(self, eval_input: EvalInput) -> List[Score]:
        return self._evaluate(eval_input)

    def _evaluate(self, eval_input: EvalInput) -> List[Score]:
        output = eval_input["output"]

        matches = self.pattern.findall(output)

        explanation = (
            f"There are {len(matches)} matches for the regex: {self._raw_pattern}"
            if matches
            else f"No substrings matched the regex pattern {self._raw_pattern}"
        )

        return [
            Score(
                score=float(bool(matches)),
                name=self.name,
                explanation=explanation if self.include_explanation else None,
                kind=self.kind,
                direction=self.direction,
            )
        ]
