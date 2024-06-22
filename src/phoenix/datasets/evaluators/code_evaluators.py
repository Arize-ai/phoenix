import json
import re
from typing import TYPE_CHECKING, List, Optional, Union

from phoenix.datasets.evaluators._utils import _unwrap_json
from phoenix.datasets.types import EvaluationResult, Example, ExperimentEvaluator, ExperimentRun


class JSONParsable:
    annotator_kind = "CODE"
    name = "JSONParsable"

    def evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        assert exp_run.output is not None
        output = _unwrap_json(exp_run.output.result)
        assert isinstance(output, str), "Experiment run output must be a string"
        try:
            json.loads(output)
            json_parsable = True
        except BaseException:
            json_parsable = False
        return EvaluationResult(
            score=int(json_parsable),
        )


class ContainsKeyword:
    annotator_kind = "CODE"

    def __init__(self, keyword: str, name: Optional[str] = None) -> None:
        self.keyword = keyword
        self.name = name or f"Contains({repr(keyword)})"

    def evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        assert exp_run.output is not None
        result = _unwrap_json(exp_run.output.result)
        assert isinstance(result, str), "Experiment run output must be a string"
        found = self.keyword in result
        return EvaluationResult(
            score=float(found),
            explanation=(
                f"the string {repr(self.keyword)} was "
                f"{'found' if found else 'not found'} in the output"
            ),
        )


class ContainsAnyKeyword:
    annotator_kind = "CODE"

    def __init__(self, keywords: List[str], name: Optional[str] = None) -> None:
        self.keywords = keywords
        self.name = name or f"ContainsAny({keywords})"

    def evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        assert exp_run.output is not None
        result = _unwrap_json(exp_run.output.result)
        assert isinstance(result, str), "Experiment run output must be a string"
        found = [keyword for keyword in self.keywords if keyword in result]
        if found:
            explanation = f"the keywords {found} were found in the output"
        else:
            explanation = f"none of the keywords {self.keywords} were found in the output"
        return EvaluationResult(
            score=float(bool(found)),
            explanation=explanation,
        )


class ContainsAllKeywords:
    annotator_kind = "CODE"

    def __init__(self, keywords: List[str], name: Optional[str] = None) -> None:
        self.keywords = keywords
        self.name = name or f"ContainsAll({keywords})"

    def evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        assert exp_run.output is not None
        result = _unwrap_json(exp_run.output.result)
        assert isinstance(result, str), "Experiment run output must be a string"
        not_found = [keyword for keyword in self.keywords if keyword not in result]
        if not_found:
            contains_all = False
            explanation = f"the keywords {not_found} were not found in the output"
        else:
            contains_all = True
            explanation = f"all of the keywords {self.keywords} were found in the output"
        return EvaluationResult(
            score=float(contains_all),
            explanation=explanation,
        )


class MatchesRegex:
    annotator_kind = "CODE"

    def __init__(self, pattern: Union[str, re.Pattern], name: Optional[str] = None) -> None:
        if isinstance(pattern, str):
            pattern = re.compile(pattern)
        self.pattern = pattern
        assert isinstance(pattern, re.Pattern)
        self.name = name or f"MatchesRegex({pattern})"

    def evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        assert exp_run.output is not None
        result = _unwrap_json(exp_run.output.result)
        assert isinstance(result, str), "Experiment run output must be a string"
        matches = self.pattern.findall(result)
        if matches:
            explanation = (
                f"the substrings {matches} matched the regex pattern {self.pattern.pattern}"
            )
        else:
            explanation = f"no substrings matched the regex pattern {self.pattern.pattern}"
        return EvaluationResult(
            score=float(bool(matches)),
            explanation=explanation,
        )


# Someday we'll do typing checking in unit tests.
if TYPE_CHECKING:
    _: ExperimentEvaluator
    _ = JSONParsable()
    _ = ContainsKeyword("test")
