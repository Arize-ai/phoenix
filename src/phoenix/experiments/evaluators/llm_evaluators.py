import re
from types import MappingProxyType
from typing import Any, Callable, Optional, Type

from phoenix.evals.models.base import BaseModel as LLMBaseModel
from phoenix.evals.utils import snap_to_rail
from phoenix.experiments.evaluators.base import (
    ExperimentEvaluator,
    LLMEvaluator,
)
from phoenix.experiments.evaluators.utils import unwrap_json
from phoenix.experiments.types import (
    EvaluationResult,
    ExampleInput,
    ExampleMetadata,
    TaskOutput,
)


class LLMCriteriaEvaluator(LLMEvaluator):
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
        "Follow this template for the following example:\n\n"
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
        self._name = name

    def evaluate(self, *, output: Optional[TaskOutput] = None, **_: Any) -> EvaluationResult:
        formatted_template = self._format_eval_template(output)
        unparsed_response = self.model._generate(formatted_template)
        return self._parse_eval_output(unparsed_response)

    async def async_evaluate(
        self, *, output: Optional[TaskOutput] = None, **_: Any
    ) -> EvaluationResult:
        formatted_template = self._format_eval_template(output)
        unparsed_response = await self.model._async_generate(formatted_template)
        return self._parse_eval_output(unparsed_response)

    def _format_eval_template(self, output: TaskOutput) -> str:
        assert output is not None
        result = unwrap_json(output)
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
    class_name: str, criteria: str, description: str, default_name: str
) -> Type[ExperimentEvaluator]:
    def _init(self, model: LLMBaseModel, name: str = default_name) -> None:  # type: ignore
        LLMCriteriaEvaluator.__init__(self, model, criteria, description, name=name)

    return type(
        class_name,
        (LLMCriteriaEvaluator,),
        {
            "__init__": _init,
            "__module__": __name__,
            "template": LLMCriteriaEvaluator._format_base_template(criteria, description),
        },
    )


ConcisenessEvaluator = criteria_evaluator_factory(
    class_name="ConcisenessEvaluator",
    criteria="concise",
    description="is just a few sentences and easy to follow",
    default_name="Conciseness",
)


HelpfulnessEvaluator = criteria_evaluator_factory(
    class_name="HelpfulnessEvaluator",
    criteria="helpful",
    description="provides useful information",
    default_name="Helpfulness",
)


CoherenceEvaluator = criteria_evaluator_factory(
    class_name="CoherenceEvaluator",
    criteria="coherent",
    description="is coherent, well-structured, and logically sound",
    default_name="Coherence",
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


class RelevanceEvaluator(LLMEvaluator):
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
        get_query: Optional[Callable[[ExampleInput, ExampleMetadata], str]] = None,
        get_response: Optional[Callable[[Optional[TaskOutput], ExampleMetadata], str]] = None,
        name: str = "RelevanceEvaluator",
    ):
        self.model = model
        self._name = name
        self.get_query = get_query or self._default_get_query
        self.get_response = get_response or self._default_get_response

    def _format_eval_template(
        self,
        output: Optional[TaskOutput] = None,
        input: ExampleInput = MappingProxyType({}),
        metadata: ExampleMetadata = MappingProxyType({}),
    ) -> str:
        assert output is not None
        query = self.get_query(input, metadata)
        response = self.get_response(output, metadata)
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

    def _default_get_query(self, input: ExampleInput, *args: Any, **kwargs: Any) -> str:
        return str(input)

    def _default_get_response(
        self, output: Optional[TaskOutput] = None, *args: Any, **kwargs: Any
    ) -> str:
        assert output is not None
        return str(unwrap_json(output))

    def evaluate(
        self,
        *,
        output: Optional[TaskOutput] = None,
        metadata: ExampleMetadata = MappingProxyType({}),
        input: ExampleInput = MappingProxyType({}),
        **_: Any,
    ) -> EvaluationResult:
        formatted_template = self._format_eval_template(output, input, metadata)
        unparsed_response = self.model._generate(formatted_template)
        return self._parse_eval_output(unparsed_response)

    async def async_evaluate(
        self,
        *,
        output: Optional[TaskOutput] = None,
        metadata: ExampleMetadata = MappingProxyType({}),
        input: ExampleInput = MappingProxyType({}),
        **_: Any,
    ) -> EvaluationResult:
        formatted_template = self._format_eval_template(output, input, metadata)
        unparsed_response = await self.model._async_generate(formatted_template)
        return self._parse_eval_output(unparsed_response)
