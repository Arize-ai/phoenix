import json
from dataclasses import dataclass
from typing import Any, List, Mapping, Optional, Protocol, cast

from .models.openai import OpenAIModel, OpenAIResponse
from .templates import PromptTemplate

Record = Mapping[str, Any]


@dataclass
class Eval:
    """
    An evaluation and optional explanation. Examples may include relevance,
    hallucination, or toxicity classifications.
    """

    value: str
    explanation: Optional[str] = None


class Evaluator(Protocol):
    """
    An interface for evaluators, which evaluate individual records, i.e., data
    points.
    """

    def evaluate(self, record: Record) -> Eval:
        ...


class LLMFunctionCallingEvaluator:
    def __init__(
        self,
        model: OpenAIModel,
        template: PromptTemplate,
        rails: List[str],
        function_name: str,
        function_description: str,
        argument_name: str,
        argument_description: str,
        system_message: Optional[str] = None,
        fallback_rail: str = "UNPARSABLE",
        provide_explanation: bool = False,
    ) -> None:
        """
        An evaluator for classifying records using LLMs that support function
        calling (currently limited to OpenAI models).

        Args:
            model (OpenAIModel): An OpenAI model that supports function calling.

            template (PromptTemplate): A prompt template containing instructions
            for classifying individual records.

            rails (List[str]): The expected output classes into which records
            should be classified.

            function_name (str): The name of the function to call in the
            function calling API. An example includes.

            function_description (str): The description of the purpose. For
            example, if classifying relevance, a reasonable description would be
            "A function to record the relevance or irrelevance of individual
            query-context pairs".

            argument_name (str): The name of the argument to pass to the
            function. For example, if classifying relevance, a reasonable
            argument name would be "relevance".

            argument_description (str): A description of the argument. For
            example, if classifying relevance, a reasonable description would be
            "The relevance of the query to the reference." This description need
            not explicitly include the rail classes.

            system_message (Optional[str], optional): A system message to
            provide to the LLM.

            fallback_rail (str, optional): If the output does not belong to one
            of the output rails, a default value to return.

            provide_explanation (bool, optional): Whether or not to provide an
            explanation for the classification. If true, the explanation will be
            returned as part of the Eval object. Note that explanations
            potentially introduce latency and cost to each classification. This
            argument is overridden by the argument of the same name in the
            evaluate method.
        """
        if not isinstance(model, OpenAIModel):
            raise ValueError(
                f"Model must be an instance of {repr(OpenAIModel.__name__)}, "
                f"but has type {repr(model.__class__.__name__)}."
            )

        self._model = model
        self._template = template
        self._rails = rails
        self._function_name = function_name
        self._function_description = function_description
        self._argument_name = argument_name
        self._argument_description = argument_description
        self._system_message = system_message
        self._fallback_rail = fallback_rail
        self._provide_explanation = provide_explanation

    def evaluate(self, record: Record, provide_explanation: Optional[bool] = None) -> Eval:
        """
        Classifies an individual record and optionally provides an explanation
        for the classification.

        Args:
            record (Record): An individual record to classify.

            provide_explanation (Optional[bool], optional): Whether or not to
            explain the classification.

        Returns:
            Eval: An evaluation containing the classification and an optional explanation.
        """
        user_message = self._template.format(
            {variable_name: record[variable_name] for variable_name in self._template.variables}
        )
        arguments_schema = {
            self._argument_name: {
                "type": "string",
                "description": self._argument_description,
                "enum": self._rails,
            },
        }
        required_arguments = [self._argument_name]
        if provide_explanation or (provide_explanation is None and self._provide_explanation):
            arguments_schema["explanation"] = {
                "type": "string",
                "description": "A brief explanation of the reasoning for your answer.",
            }
            required_arguments.append("explanation")
        responses = self._model.generate(
            [user_message],
            instruction=self._system_message,
            functions=[
                {
                    "name": self._function_name,
                    "description": self._function_description,
                    "parameters": {
                        "type": "object",
                        "properties": arguments_schema,
                        "required": required_arguments,
                    },
                }
            ],
            function_call={"name": self._function_name},
        )
        response = cast(OpenAIResponse, responses[0])
        try:
            function_arguments = (
                json.loads(arguments_json_string)
                if (arguments_json_string := response.function_call_arguments_json)
                else {}
            )
            explanation = function_arguments.get("explanation")
            return (
                Eval(
                    value=output_rail,
                    explanation=explanation,
                )
                if (output_rail := function_arguments[self._argument_name]) in self._rails
                else Eval(value=self._fallback_rail, explanation=explanation)
            )
        except (json.JSONDecodeError, KeyError):
            pass
        return Eval(value=self._fallback_rail)
