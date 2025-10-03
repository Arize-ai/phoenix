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

    This heuristic evaluator checks if the output contains one or more substrings that
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

            from phoenix.evals.metrics.matches_regex import MatchesRegex

            # Create a regex evaluator to check if output contains a link
            contains_link = MatchesRegex(pattern=r"https?://[^\\s]+")

            eval_input = {
                "output": "Here is the official site: https://openai.com"
            }

            scores = contains_link.evaluate(eval_input)
            print(scores)
            # [Score(
            #     name='matches_regex',
            #     score=1.0,
            #     explanation="the substrings ['https://openai.com'] matched the regex pattern https?://[^\\s]+",
            #     source='heuristic',
            #     direction='maximize'
            # )]
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
            pattern = re.compile(pattern)

        self.pattern = pattern
        self.include_explanation = include_explanation
        eval_name = name or "matches_regex"

        super().__init__(
            name=eval_name,
            source="heuristic",
            input_schema=self.InputSchema,
            direction="maximize",
        )

    async def _async_evaluate(self, eval_input: EvalInput) -> List[Score]:
        return self._evaluate(eval_input)

    def _evaluate(self, eval_input: EvalInput) -> List[Score]:
        output = eval_input["output"]

        matches = self.pattern.findall(output)

        explanation = (
            f"There are {len(matches)} matches for the regex: {self.pattern.pattern}"
            if matches
            else f"No substrings matched the regex pattern {self.pattern.pattern}"
        )

        return [
            Score(
                score=float(bool(matches)),
                name=self.name,
                explanation=explanation if self.include_explanation else None,
                source=self.source,
                direction=self.direction,
            )
        ]
