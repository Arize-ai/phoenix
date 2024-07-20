from __future__ import annotations

import json
import re
from typing import Any, List, Optional, Union

from phoenix.experiments.evaluators.base import CodeEvaluator
from phoenix.experiments.types import EvaluationResult, TaskOutput


class JSONParsable(CodeEvaluator):
    """
    An evaluator that checks if the output of an experiment run is a JSON-parsable string.

    Example:

        .. code-block:: python
            from phoenix.experiments import run_experiment
            from phoenix.experiments.evaluators import JSONParsable

            run_experiment(dataset, task, evaluators=[JSONParsable])
    """

    @classmethod
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


class ContainsKeyword(CodeEvaluator):
    """
    An evaluator that checks if a keyword is present in the output of an experiment run.

    Args:
        keyword (str): The keyword to search for in the output.
        name (str, optional): An optional name for the evaluator. Defaults to "Contains(<keyword>)".

    Example:

        .. code-block:: python
            from phoenix.experiments import run_experiment
            from phoenix.experiments.evaluators import ContainsKeyword

            run_experiment(dataset, task, evaluators=[ContainsKeyword("foo")])
    """

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


class ContainsAnyKeyword(CodeEvaluator):
    """
    An evaluator that checks if any of the keywords are present in the output of an experiment run.

    Args:
        keywords (List[str]): The keywords to search for in the output.
        name (str, optional): An optional name for the evaluator. Defaults to
            "ContainsAny(<keywords>)".

    Example:

        .. code-block:: python
            from phoenix.experiments import run_experiment
            from phoenix.experiments.evaluators import ContainsAnyKeyword

            run_experiment(dataset, task, evaluators=[ContainsAnyKeyword(["foo", "bar"])])
    """

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


class ContainsAllKeywords(CodeEvaluator):
    """
    An evaluator that checks if all of the keywords are present in the output of an experiment run.

    Args:
        keywords (List[str]): The keywords to search for in the output.
        name (str, optional): An optional name for the evaluator. Defaults to
            "ContainsAll(<keywords>)".

    Example:
        .. code-block:: python

            from phoenix.experiments import run_experiment
            from phoenix.experiments.evaluators import ContainsAllKeywords

            run_experiment(dataset, task, evaluators=[ContainsAllKeywords(["foo", "bar"])])
    """

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


class MatchesRegex(CodeEvaluator):
    r"""
    An experiment evaluator that checks if the output of an experiment run matches a regex pattern.

    Args:
        pattern (Union[str, re.Pattern[str]]): The regex pattern to match the output against.
        name (str, optional): An optional name for the evaluator. Defaults to "matches_({pattern})".

    Example:
        .. code-block:: python

            from phoenix.experiments import run_experiment
            from phoenix.experiments.evaluators import MatchesRegex

            phone_number_evaluator = MatchesRegex(r"\d{3}-\d{3}-\d{4}", name="valid-phone-number")
            run_experiment(dataset, task, evaluators=[phone_number_evaluator])
    """

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
