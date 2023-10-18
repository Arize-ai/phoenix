import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, List, Mapping, Optional

from .models.openai import OpenAIModel
from .templates import PromptTemplate

Rail = str
Record = Mapping[str, Any]


@dataclass
class LLMClassification:
    output_rail: Rail
    explanation: Optional[str] = None


class LLMClassifier(ABC):
    @abstractmethod
    def predict(self, record: Record) -> LLMClassification:
        ...


class FunctionCallingClassifier(LLMClassifier):
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

    def predict(
        self, record: Record, provide_explanation: Optional[bool] = None
    ) -> LLMClassification:
        user_message_content = self._template.format(
            {variable_name: record[variable_name] for variable_name in self._template.variables}
        )
        argument_data = {
            self._argument_name: {
                "type": "string",
                "description": self._argument_description,
                "enum": self._rails,
            },
        }
        required_arguments = [self._argument_name]
        if provide_explanation or self._provide_explanation:
            argument_data["explanation"] = {
                "type": "string",
                "description": "A brief explanation of the reasoning for your answer.",
            }
            required_arguments.append("explanation")
        functions = [
            {
                "name": self._function_name,
                "description": self._function_description,
                "parameters": {
                    "type": "object",
                    "properties": argument_data,
                    "required": required_arguments,
                },
            }
        ]
        responses = self._model.generate(
            [user_message_content],
            instruction=self._system_message,
            functions=functions,
            function_call={"name": self._function_name},
        )
        try:
            response = responses[0]
            function_arguments = (
                json.loads(arguments_json_string)
                if (arguments_json_string := response.function_call)
                else {}
            )
            return LLMClassification(
                output_rail=function_arguments[self._argument_name],
                explanation=function_arguments.get("explanation"),
            )
        except json.JSONDecodeError:
            pass
        return LLMClassification(output_rail=self._fallback_rail)
