from __future__ import annotations

import json
import re
from typing import Any, List, Optional, Union

from phoenix.datasets.evaluators.utils import Evaluator
from phoenix.datasets.types import EvaluationResult, TaskOutput


class JSONParsable(Evaluator):
    def evaluate(self, *, output: Optional[TaskOutput] = None, **_: Any) -> EvaluationResult:
        assert isinstance(output, str), "Experiment run output must be a string"
        try:
            json.loads(output)
            json_parsable = True
        except BaseException:
            json_parsable = False
        return EvaluationResult(
            score=int(json_parsable),
        )


class ContainsKeyword(Evaluator):
    def __init__(self, keyword: str, name: Optional[str] = None) -> None:
        self.keyword = keyword
        self._name = name or f"Contains({repr(keyword)})"

    def evaluate(self, *, output: Optional[TaskOutput] = None, **_: Any) -> EvaluationResult:
        assert isinstance(output, str), "Experiment run output must be a string"
        found = self.keyword in output
        return EvaluationResult(
            score=float(found),
            explanation=(
                f"the string {repr(self.keyword)} was "
                f"{'found' if found else 'not found'} in the output"
            ),
        )


class ContainsAnyKeyword(Evaluator):
    def __init__(self, keywords: List[str], name: Optional[str] = None) -> None:
        self.keywords = keywords
        self._name = name or f"ContainsAny({keywords})"

    def evaluate(self, *, output: Optional[TaskOutput] = None, **_: Any) -> EvaluationResult:
        assert isinstance(output, str), "Experiment run output must be a string"
        found = [keyword for keyword in self.keywords if keyword in output]
        if found:
            explanation = f"the keywords {found} were found in the output"
        else:
            explanation = f"none of the keywords {self.keywords} were found in the output"
        return EvaluationResult(
            score=float(bool(found)),
            explanation=explanation,
        )


class ContainsAllKeywords(Evaluator):
    def __init__(self, keywords: List[str], name: Optional[str] = None) -> None:
        self.keywords = keywords
        self._name = name or f"ContainsAll({keywords})"

    def evaluate(self, *, output: Optional[TaskOutput] = None, **_: Any) -> EvaluationResult:
        assert isinstance(output, str), "Experiment run output must be a string"
        not_found = [keyword for keyword in self.keywords if keyword not in output]
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


class MatchesRegex(Evaluator):
    def __init__(self, pattern: Union[str, re.Pattern[str]], name: Optional[str] = None) -> None:
        if isinstance(pattern, str):
            pattern = re.compile(pattern)
        self.pattern = pattern
        assert isinstance(pattern, re.Pattern)
        self._name = name or f"matches_({pattern})"

    def evaluate(self, *, output: Optional[TaskOutput] = None, **_: Any) -> EvaluationResult:
        assert isinstance(output, str), "Experiment run output must be a string"
        matches = self.pattern.findall(output)
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
