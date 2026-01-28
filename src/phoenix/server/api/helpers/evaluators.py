from typing import Literal, Optional

from pydantic import (
    BaseModel,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)
from typing_extensions import Self, assert_never

from phoenix.db import models
from phoenix.db.types.annotation_configs import CategoricalAnnotationConfig
from phoenix.server.api.helpers.prompts.models import (
    PromptResponseFormat,
    PromptToolChoiceOneOrMore,
    PromptToolChoiceSpecificFunctionTool,
    PromptToolFunction,
    PromptTools,
)


def validate_evaluator_prompt_and_config(
    *,
    prompt_tools: Optional[PromptTools],
    prompt_response_format: Optional[PromptResponseFormat],
    evaluator_annotation_name: str,
    evaluator_output_config: CategoricalAnnotationConfig,
    evaluator_description: Optional[str] = None,
) -> None:
    if prompt_response_format is not None:
        raise ValueError(_LLMEvaluatorPromptErrorMessage.RESPONSE_FORMAT_NOT_SUPPORTED)
    if prompt_tools is None:
        raise ValueError(_LLMEvaluatorPromptErrorMessage.TOOLS_REQUIRED)
    if len(prompt_tools.tools) != 1:
        raise ValueError(_LLMEvaluatorPromptErrorMessage.EXACTLY_ONE_TOOL_REQUIRED)
    if not isinstance(
        prompt_tools.tool_choice, (PromptToolChoiceOneOrMore, PromptToolChoiceSpecificFunctionTool)
    ):
        raise ValueError(_LLMEvaluatorPromptErrorMessage.TOOL_CHOICE_REQUIRED)
    if isinstance(prompt_tools.tool_choice, PromptToolChoiceSpecificFunctionTool):
        if prompt_tools.tool_choice.function_name != prompt_tools.tools[0].function.name:
            raise ValueError(
                _LLMEvaluatorPromptErrorMessage.TOOL_CHOICE_SPECIFIC_FUNCTION_NAME_MUST_MATCH_DEFINED_FUNCTION_NAME
            )
    prompt_tool = prompt_tools.tools[0]
    if not isinstance(prompt_tool, PromptToolFunction):
        assert_never(prompt_tool)
    prompt_tool_function_definition = prompt_tool.function
    prompt_tool_function_definition_description = (
        prompt_tool_function_definition.description
        if isinstance(prompt_tool_function_definition.description, str)
        else None
    )
    if (
        # if the evaluator description is not None, it must match the function description
        # the function may have an empty string as its description, as required by the Anthropic API
        evaluator_description is not None
        and evaluator_description != prompt_tool_function_definition_description
    ):
        raise ValueError(
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION
        )

    try:
        function_parameters = _EvaluatorPromptToolFunctionParameters.model_validate(
            prompt_tool_function_definition.parameters
        )
    except ValidationError as error:
        raise ValueError(
            _parse_pydantic_validation_error(
                function_name=prompt_tool_function_definition.name,
                validation_error=error,
            )
        )
    function_label_property_description = function_parameters.properties.label.description
    if function_label_property_description != evaluator_annotation_name:
        raise ValueError(
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_ANNOTATION_NAME_MUST_MATCH_FUNCTION_LABEL_PROPERTY_DESCRIPTION
        )
    labels = function_parameters.properties.label.enum
    evaluator_choices = [value.label for value in evaluator_output_config.values]
    if set(labels) != set(evaluator_choices):
        raise ValueError(
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_CHOICES_MUST_MATCH_TOOL_FUNCTION_LABELS
        )


class _EvaluatorPromptToolFunctionParametersLabelProperty(BaseModel):
    type: Literal["string"]
    enum: list[str] = Field(
        min_length=2,
    )
    description: str


class _EvaluatorPromptToolFunctionParametersExplanationProperty(BaseModel):
    type: Literal["string"]
    description: str


def validate_consistent_llm_evaluator_and_prompt_version(
    prompt_version: models.PromptVersion,
    llm_evaluator: models.LLMEvaluator,
) -> None:
    validate_evaluator_prompt_and_config(
        prompt_tools=prompt_version.tools,
        prompt_response_format=prompt_version.response_format,
        evaluator_annotation_name=llm_evaluator.output_config.name or "",
        evaluator_output_config=llm_evaluator.output_config,
        evaluator_description=llm_evaluator.description,
    )


class _EvaluatorPromptToolFunctionParametersProperty(BaseModel):
    label: _EvaluatorPromptToolFunctionParametersLabelProperty
    explanation: Optional[_EvaluatorPromptToolFunctionParametersExplanationProperty] = None

    @model_validator(mode="after")
    def check_explanation_property_is_string_or_omitted(self) -> Self:
        explanation_explicitly_set = "explanation" in self.model_fields_set
        if explanation_explicitly_set and self.explanation is None:
            raise ValueError(
                _LLMEvaluatorPromptErrorMessage.EXPLANATION_PROPERTIES_MUST_BE_STRING_OR_OMITTED
            )
        return self


class _EvaluatorPromptToolFunctionParameters(BaseModel):
    type: Literal["object"]
    properties: _EvaluatorPromptToolFunctionParametersProperty
    required: list[str]

    @field_validator("required")
    @classmethod
    def check_required_values_are_unique(cls, values: list[str]) -> list[str]:
        if len(values) != len(set(values)):
            raise ValueError(_LLMEvaluatorPromptErrorMessage.REQUIRED_VALUES_MUST_BE_UNIQUE)
        return values

    @model_validator(mode="after")
    def check_all_properties_are_required(self) -> Self:
        has_explanation = self.properties.explanation is not None
        expected = {"label", "explanation"} if has_explanation else {"label"}
        if unexpected := (set(self.required) - expected):
            raise ValueError(
                _LLMEvaluatorPromptErrorMessage.UNEXPECTED_REQUIRED_PROPERTIES.format(
                    properties=", ".join(sorted(unexpected))
                )
            )
        if missing := (expected - set(self.required)):
            raise ValueError(
                _LLMEvaluatorPromptErrorMessage.MISSING_REQUIRED_PROPERTIES.format(
                    properties=", ".join(sorted(missing))
                )
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


class _LLMEvaluatorPromptErrorMessage:
    RESPONSE_FORMAT_NOT_SUPPORTED = "Response format is not supported for evaluator prompts"
    TOOLS_REQUIRED = "Evaluator prompts require tools"
    EXACTLY_ONE_TOOL_REQUIRED = "Evaluator prompts require exactly one tool"
    TOOL_CHOICE_REQUIRED = "Evaluator prompts must require a tool choice"
    TOOL_CHOICE_SPECIFIC_FUNCTION_NAME_MUST_MATCH_DEFINED_FUNCTION_NAME = (
        "Evaluator tool choice specific function name must match defined function name"
    )
    EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION = (
        "Evaluator description must match the function description"
    )
    REQUIRED_VALUES_MUST_BE_UNIQUE = "Required values must be unique"
    MISSING_REQUIRED_PROPERTIES = "The following properties must be required: {properties}"
    UNEXPECTED_REQUIRED_PROPERTIES = "Found unexpected required properties: {properties}"
    EVALUATOR_ANNOTATION_NAME_MUST_MATCH_FUNCTION_LABEL_PROPERTY_DESCRIPTION = (
        "Evaluator annotation name must match function parameters label property description"
    )
    EVALUATOR_CHOICES_MUST_MATCH_TOOL_FUNCTION_LABELS = (
        "Evaluator choices must match tool function label property enum"
    )
    EXPLANATION_PROPERTIES_MUST_BE_STRING_OR_OMITTED = (
        "The 'explanation' property must be omitted or set to a string."
    )
