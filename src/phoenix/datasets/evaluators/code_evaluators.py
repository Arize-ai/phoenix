import json
from typing import TYPE_CHECKING, Optional

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
        self.name = name or f"ContainsKeyword({keyword})"

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


# Someday we'll do typing checking in unit tests.
if TYPE_CHECKING:
    _: ExperimentEvaluator
    _ = JSONParsable()
    _ = ContainsKeyword("test")
