import json
import re
from typing import TYPE_CHECKING, Callable, Optional, Type

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


class ContainsKeyword:
    annotator_kind = "CODE"

    def __init__(self, keyword: str) -> None:
        super().__init__()
        self.keyword = keyword
        self.name = f"ContainsKeyword({keyword})"

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


class LLMCriteriaEvaluator:
    annotator_kind = "LLM"
    _base_template = (
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
    _description = "In this context, '{criteria}' means the text '{description}'. "

    def __init__(
        self,
        model: LLMBaseModel,
        criteria: str,
        description: str,
        name: str,
    ):
        self.model = model
        self.criteria = criteria
        self.description = description
        self.template = self._format_base_template(self.criteria, self.description)
        self.name = name

    def evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        formatted_template = self._format_eval_template(exp_run)
        unparsed_response = self.model._generate(formatted_template)
        return self._parse_eval_output(unparsed_response)

    async def async_evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        formatted_template = self._format_eval_template(exp_run)
        unparsed_response = await self.model._async_generate(formatted_template)
        return self._parse_eval_output(unparsed_response)

    def _format_eval_template(self, experiment_run: ExperimentRun) -> str:
        assert experiment_run.output is not None
        result = _unwrap_json(experiment_run.output.result)
        return self.template.format(text=str(result))

    def _parse_eval_output(self, unparsed_response: str) -> EvaluationResult:
        raw_label, explanation = (
            _parse_label_from_explanation(unparsed_response),
            unparsed_response,
        )
        label = snap_to_rail(raw_label, ["true", "false"])
        if label == "true":
            score = 1.0
        elif label == "false":
            score = 0.0
        else:
            raise RuntimeError(f"Could not parse LLM evaluation: {unparsed_response}")
        return EvaluationResult(
            score=score,
            explanation=explanation,
            metadata={},
        )

    @classmethod
    def _format_base_template(cls, criteria: str, description: Optional[str] = None) -> str:
        formatted_description = cls._description.format(criteria=criteria, description=description)
        formatted_template = cls._base_template.format(
            criteria=criteria,
            description=formatted_description,
            text="{text}",  # leave the text field as a placeholder
        )
        return formatted_template


def criteria_evaluator_factory(
    class_name: str, criteria: str, description: str
) -> Type[ExperimentEvaluator]:
    return type(
        class_name,
        (LLMCriteriaEvaluator,),
        {
            "__init__": lambda self, model: LLMCriteriaEvaluator.__init__(
                self, model, criteria, description, name=class_name
            ),
            "__module__": __name__,
            "name": class_name,
            "template": LLMCriteriaEvaluator._format_base_template(criteria, description),
        },
    )


LLMConcisenessEvaluator = criteria_evaluator_factory(
    class_name="LLMConcisenessEvaluator",
    criteria="concise",
    description="is just a few sentences and easy to follow",
)


LLMHelpfulnessEvaluator = criteria_evaluator_factory(
    class_name="LLMHelpfulnessEvaluator",
    criteria="helpful",
    description="provides useful information",
)


LLMCoherenceEvaluator = criteria_evaluator_factory(
    class_name="LLMCoherenceEvaluator",
    criteria="coherent",
    description="is coherent, well-structured, and organized",
)


def _parse_label_from_explanation(raw_string: str) -> str:
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


class RelevanceEvaluator:
    annotator_kind = "LLM"
    template = (
        "Determine if the following response is relevant to the query. In this context, "
        "'relevance' means that the response directly addresses the core question or topic of the "
        "query. First, explain step-by-step why you think the text is or is not relevant. "
        "Then provide a single word label; 'true' if the text is relevant or 'false' if the text "
        "is not relevant. "
        "Here is an example template for your reponse:\n\n"
        "CRITERIA: the response is 'relevant' to the query\n"
        "QUERY: *text that contains a query*\n"
        "RESPONSE: *a response that may or may not be relevant to the query*\n"
        "EXPLANATION: *a step by step explanation of your reasoning for whether or not the "
        "response is relevant to the query*\n"
        "LABEL: *true or false*\n\n"
        "Follow this template for the following example:\n\n"
        "CRITERIA: the response is 'relevant' to the query\n"
        "QUERY: {reference}\n"
        "RESPONSE: {submission}\n"
        "EXPLANATION: "
    )

    def __init__(
        self,
        model: LLMBaseModel,
        get_query: Optional[Callable[[Example, ExperimentRun], str]] = None,
        get_response: Optional[Callable[[Example, ExperimentRun], str]] = None,
        name: str = "RelevanceEvaluator",
    ):
        self.model = model
        self.name = name
        self.get_query = get_query or self._default_get_query
        self.get_response = get_response or self._default_get_response

    def _format_eval_template(self, example: Example, experiment_run: ExperimentRun) -> str:
        assert experiment_run.output is not None
        query = self.get_query(example, experiment_run)
        response = self.get_response(example, experiment_run)
        return self.template.format(query=query, response=response)

    def _parse_eval_output(self, unparsed_response: str) -> EvaluationResult:
        raw_label, explanation = (
            _parse_label_from_explanation(unparsed_response),
            unparsed_response,
        )
        label = snap_to_rail(raw_label, ["true", "false"])
        if label == "true":
            score = 1.0
        elif label == "false":
            score = 0.0
        else:
            raise RuntimeError(f"Could not parse LLM evaluation: {unparsed_response}")
        return EvaluationResult(
            score=score,
            explanation=explanation,
            metadata={},
        )

    def _default_get_query(self, example: Example, experiment_run: ExperimentRun) -> str:
        return example.input

    def _default_get_response(self, example: Example, experiment_run: ExperimentRun) -> str:
        assert experiment_run.output is not None
        return _unwrap_json(experiment_run.output.result)

    def evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        formatted_template = self._format_eval_template(example, exp_run)
        unparsed_response = self.model._generate(formatted_template)
        return self._parse_eval_output(unparsed_response)

    async def async_evaluate(self, example: Example, exp_run: ExperimentRun) -> EvaluationResult:
        formatted_template = self._format_eval_template(example, exp_run)
        unparsed_response = await self.model._async_generate(formatted_template)
        return self._parse_eval_output(unparsed_response)


# Someday we'll do typing checking in unit tests.
if TYPE_CHECKING:
    _: ExperimentEvaluator
    _ = JSONParsable()
    _ = ContainsKeyword("test")
