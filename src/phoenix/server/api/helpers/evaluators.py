from enum import Enum
from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)
from typing_extensions import Self, assert_never

from phoenix.db import models
from phoenix.server.api.helpers.prompts.models import (
    PromptToolChoiceOneOrMore,
    PromptToolChoiceSpecificFunctionTool,
    PromptToolFunction,
)


def validate_consistent_llm_evaluator_and_prompt_version(
    prompt_version: models.PromptVersion,
    evaluator: models.LLMEvaluator,
) -> None:
    """
    Checks that the LLM evaluator and prompt version are consistent, e.g., that corresponding fields
    between the ORMs match. Also checks that the prompt is a valid evaluator prompt, e.g., by
    checking that it has exactly one tool. Intended to be run before inserting the validated ORMs
    into the database.
    """

    if prompt_version.response_format is not None:
        raise ValueError(_LLMEvaluatorPromptErrorMessage.RESPONSE_FORMAT_NOT_SUPPORTED.value)
    if prompt_version.tools is None:
        raise ValueError(_LLMEvaluatorPromptErrorMessage.TOOLS_REQUIRED.value)
    prompt_tools = prompt_version.tools
    if len(prompt_tools.tools) != 1:
        raise ValueError(_LLMEvaluatorPromptErrorMessage.EXACTLY_ONE_TOOL_REQUIRED.value)
    if not isinstance(
        prompt_tools.tool_choice, (PromptToolChoiceSpecificFunctionTool, PromptToolChoiceOneOrMore)
    ):
        raise ValueError(
            _LLMEvaluatorPromptErrorMessage.TOOL_CHOICE_MUST_BE_SPECIFIC_FUNCTION_TOOL.value
        )
    prompt_tool = prompt_tools.tools[0]
    if not isinstance(prompt_tool, PromptToolFunction):
        assert_never(prompt_tool)
    prompt_tool_function_definition = prompt_tool.function
    evaluator_name = evaluator.name.root
    evaluator_description = evaluator.description
    prompt_tool_function_definition_description = (
        prompt_tool_function_definition.description
        if isinstance(prompt_tool_function_definition.description, str)
        else None
    )
    if evaluator_name != prompt_tool_function_definition.name:
        raise ValueError(
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_NAME_MUST_MATCH_FUNCTION_NAME.value
        )
    if evaluator_description != prompt_tool_function_definition_description:
        raise ValueError(
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION.value
        )

    function_parameters = prompt_tool_function_definition.parameters
    try:
        _EvaluatorPromptToolFunctionParameters.model_validate(function_parameters)
    except ValidationError as error:
        raise ValueError(
            _parse_pydantic_validation_error(
                function_name=prompt_tool_function_definition.name,
                validation_error=error,
            )
        )
    function_property_name = next(iter(function_parameters["properties"].keys()))
    if function_property_name != evaluator.annotation_name:
        raise ValueError(
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_ANNOTATION_NAME_MUST_MATCH_FUNCTION_PROPERTY_NAME.value
        )
    function_property_choices = function_parameters["properties"][function_property_name]["enum"]
    evaluator_choices = [value.label for value in evaluator.output_config.values]
    if set(function_property_choices) != set(evaluator_choices):
        raise ValueError(
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_CHOICES_MUST_MATCH_FUNCTION_PROPERTY_ENUM.value
        )


class _EvaluatorPromptToolFunctionParametersProperty(BaseModel):
    type: Literal["string"]
    enum: list[str] = Field(
        ...,
        min_length=2,
    )


class _EvaluatorPromptToolFunctionParameters(BaseModel):
    type: Literal["object"]
    properties: dict[str, _EvaluatorPromptToolFunctionParametersProperty] = Field(
        ...,
        min_length=1,
        max_length=1,  # this constraint can be lifted to add support for multi-criteria evaluators
    )
    required: list[str]

    @field_validator("required")
    @classmethod
    def check_required_values_are_unique(cls, values: list[str]) -> list[str]:
        if len(values) != len(set(values)):
            raise ValueError(_LLMEvaluatorPromptErrorMessage.REQUIRED_VALUES_MUST_BE_UNIQUE.value)
        return values

    @model_validator(mode="after")
    def check_all_properties_are_required(self) -> Self:
        defined_properties = set(self.properties)
        required_properties = set(self.required)
        if defined_properties - required_properties:
            raise ValueError(
                _LLMEvaluatorPromptErrorMessage.ALL_DEFINED_PROPERTIES_MUST_BE_REQUIRED.value
            )
        if required_properties - defined_properties:
            raise ValueError(
                _LLMEvaluatorPromptErrorMessage.ALL_REQUIRED_PROPERTIES_SHOULD_BE_DEFINED.value
            )
        return self


def _parse_pydantic_validation_error(
    function_name: str,
    validation_error: ValidationError,
) -> str:
    error_messages = [f"'{function_name}' function has errors."]
    for error_details in validation_error.errors():
        error_message = ""
        if path := ".".join(map(str, error_details["loc"])):
            error_message = f"At '{path}': "
        error_details_message = error_details["msg"]
        error_message += f"{error_details_message}."
        error_messages.append(error_message)
    return " ".join(error_messages)


class _LLMEvaluatorPromptErrorMessage(Enum):
    RESPONSE_FORMAT_NOT_SUPPORTED = "Response format is not supported for evaluator prompts"
    TOOLS_REQUIRED = "Evaluator prompts require tools"
    EXACTLY_ONE_TOOL_REQUIRED = "Evaluator prompts require exactly one tool"
    TOOL_CHOICE_MUST_BE_SPECIFIC_FUNCTION_TOOL = (
        "Evaluator prompts require a particular function to be specified in the tool choice"
    )
    TOOL_MUST_BE_FUNCTION = "Evaluator prompts require a function tool"
    EVALUATOR_NAME_MUST_MATCH_FUNCTION_NAME = "Evaluator name must match the function name"
    EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION = (
        "Evaluator description must match the function description"
    )
    EVALUATOR_PARAMETERS_MUST_BE_VALID = "Evaluator parameters must be a valid JSON schema"
    REQUIRED_VALUES_MUST_BE_UNIQUE = "Required values must be unique"
    ALL_DEFINED_PROPERTIES_MUST_BE_REQUIRED = "All defined properties must be required"
    ALL_REQUIRED_PROPERTIES_SHOULD_BE_DEFINED = "All required properties must be defined"
    EVALUATOR_ANNOTATION_NAME_MUST_MATCH_FUNCTION_PROPERTY_NAME = (
        "Evaluator annotation name must match function parameters property name"
    )
    EVALUATOR_CHOICES_MUST_MATCH_FUNCTION_PROPERTY_ENUM = (
        "Evaluator choices must match function parameters property enum"
    )
