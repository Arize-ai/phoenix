import json
import re
from typing import TYPE_CHECKING

from phoenix.datasets.types import (
    EvaluationResult,
    Example,
    ExperimentEvaluator,
    ExperimentRun,
    JSONSerializable,
)
from phoenix.evals.models.base import BaseModel as LLMBaseModel
from phoenix.evals.utils import snap_to_rail


def _unwrap_json(obj: JSONSerializable) -> JSONSerializable:
    if isinstance(obj, dict):
        if len(obj) == 1:
            key = next(iter(obj.keys()))
            output = obj[key]
            assert isinstance(
                output, (dict, list, str, int, float, bool, type(None))
            ), "Output must be JSON serializable"
            return output
    return obj


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

    async def async_evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        return self.evaluate(example, exp_run)


class ContainsKeyword:
    annotator_kind = "CODE"
    name = "ContainsKeyword"

    def __init__(self, keyword: str) -> None:
        super().__init__()
        self.keyword = keyword

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

    async def async_evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        return self.evaluate(example, exp_run)


class LLMConcisenessEvaluator(ExperimentEvaluator):
    annotator_kind = "LLM"
    name = "LLMConcisenessEvaluator"
    template = (
        "Determine if the following text is concise. In this context, 'concise' means the "
        "text is just a few sentences and easy to follow. "
        "First, explain step-by-step why you think the text is or is not concise. Then provide a "
        "single word label; 'true' if the text is concise or 'false' if the text is not concise. "
        "Here is an example template for whether the text meets a criteria:\n\n"
        "CRITERIA: the text is 'concise'\n"
        "TEXT: *the provided text to evaluate*\n"
        "EXPLANATION: *a step by step explanation of your reasoning for whether the text meets "
        "the criteria*\n"
        "LABEL: *true or false*\n\n"
        "Follow this template for the following text:\n\n"
        "CRITERIA: the text is 'concise'\n"
        "TEXT: {text}\n"
        "EXPLANATION: "
    )

    def __init__(self, model: LLMBaseModel):
        self.model = model

    def evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        assert exp_run.output is not None
        result = _unwrap_json(exp_run.output.result)
        formatted_template = self.template.replace("{text}", str(result))
        unparsed_response = self.model._generate(formatted_template)
        raw_label, explanation = (
            self._parse_label_from_explanation(unparsed_response),
            unparsed_response,
        )
        label = snap_to_rail(raw_label, ["true", "false"])
        if label == "true":
            score = 1.0
        elif label == "false":
            score = 0.0
        else:
            score = None
        return EvaluationResult(
            score=score,
            explanation=explanation,
            metadata={},
        )

    async def async_evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        assert exp_run.output is not None
        result = _unwrap_json(exp_run.output.result)
        formatted_template = self.template.replace("{text}", str(result))
        unparsed_response = await self.model._async_generate(formatted_template)
        raw_label, explanation = (
            self._parse_label_from_explanation(unparsed_response),
            unparsed_response,
        )
        label = snap_to_rail(raw_label, ["true", "false"])
        meets_criteria = label == "true"
        return EvaluationResult(
            score=float(meets_criteria),
            explanation=explanation,
            metadata={},
        )

    def _parse_label_from_explanation(self, raw_string: str) -> str:
        label_delimiter = r"(\W*label\W*)"
        parts = re.split(label_delimiter, raw_string, flags=re.IGNORECASE)
        if len(parts) > 1:
            # Find the last occurrence of the delimiter and take the part after it
            last_index = len(parts) - 1
            while last_index > 0:
                if re.match(label_delimiter, parts[last_index - 1], flags=re.IGNORECASE):
                    return parts[last_index].strip()
                last_index -= 1
        return raw_string


class LLMCriteriaEvaluator(ExperimentEvaluator):
    annotator_kind = "LLM"
    name = "LLMCriteriaEvaluator"
    template = (
        "Determine if the following text is {criteria}. {description}"
        "First, explain step-by-step why you think the text is or is not {criteria}. Then provide "
        "a single word label; 'true' if the text is {criteria} or 'false' if the text is not "
        "{criteria}. Here is an example template for whether the text meets a criteria:\n\n"
        "CRITERIA: the text is '{criteria}'\n"
        "TEXT: *the provided text to evaluate*\n"
        "EXPLANATION: *a step by step explanation of your reasoning for whether the text meets "
        "the criteria*\n"
        "LABEL: *true or false*\n\n"
        "Follow this template for the following text:\n\n"
        "CRITERIA: the text is '{criteria}'\n"
        "TEXT: {text}\n"
        "EXPLANATION: "
    )
    description = "In this context, '{criteria}' means the text is '{description}'. "

    def __init__(self, model: LLMBaseModel, criteria: str, description: str):
        self.model = model
        self.criteria = criteria
        self.description = description

    def evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        assert exp_run.output is not None
        result = _unwrap_json(exp_run.output.result)
        formatted_description = self.description.replace("{criteria}", str(result))
        formatted_description = formatted_description.replace(
            "{description}", str(self.description)
        )
        formatted_template = self.template.replace("{criteria}", str(self.criteria))
        formatted_template = formatted_template.replace("{description}", str(formatted_description))
        formatted_template = formatted_template.replace("{text}", str(result))
        unparsed_response = self.model._generate(formatted_template)
        raw_label, explanation = (
            self._parse_label_from_explanation(unparsed_response),
            unparsed_response,
        )
        label = snap_to_rail(raw_label, ["true", "false"])
        if label == "true":
            score = 1.0
        elif label == "false":
            score = 0.0
        else:
            score = None
        return EvaluationResult(
            score=score,
            explanation=explanation,
            metadata={},
        )

    async def async_evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        assert exp_run.output is not None
        result = _unwrap_json(exp_run.output.result)
        formatted_template = self.template.replace("{text}", str(result))
        unparsed_response = await self.model._async_generate(formatted_template)
        raw_label, explanation = (
            self._parse_label_from_explanation(unparsed_response),
            unparsed_response,
        )
        label = snap_to_rail(raw_label, ["true", "false"])
        meets_criteria = label == "true"
        return EvaluationResult(
            score=float(meets_criteria),
            explanation=explanation,
            metadata={},
        )

    def _parse_label_from_explanation(self, raw_string: str) -> str:
        label_delimiter = r"(\W*label\W*)"
        parts = re.split(label_delimiter, raw_string, flags=re.IGNORECASE)
        if len(parts) > 1:
            # Find the last occurrence of the delimiter and take the part after it
            last_index = len(parts) - 1
            while last_index > 0:
                if re.match(label_delimiter, parts[last_index - 1], flags=re.IGNORECASE):
                    return parts[last_index].strip()
                last_index -= 1
        return raw_string


# Someday we'll do typing checking in unit tests.
if TYPE_CHECKING:
    _: ExperimentEvaluator
    _ = JSONParsable()
    _ = ContainsKeyword("test")
