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
        raise ValueError(_LLMEvaluatorPromptErrorMessage.RESPONSE_FORMAT_NOT_SUPPORTED)
    if prompt_version.tools is None:
        raise ValueError(_LLMEvaluatorPromptErrorMessage.TOOLS_REQUIRED)
    prompt_tools = prompt_version.tools
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
    evaluator_description = evaluator.description
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
    function_label_property_description = function_parameters.properties["label"].description
    if function_label_property_description != evaluator.annotation_name:
        raise ValueError(
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_ANNOTATION_NAME_MUST_MATCH_FUNCTION_LABEL_PROPERTY_DESCRIPTION
        )
    # we support properties of two shapes:
    # - string property with enum and description (for categorical evaluators)
    # - string property with description (for evaluator explanations)

    # validate that "label" exists, and that it is a string property with enum
    function_property_choices = function_parameters.properties["label"].enum
    if function_property_choices is None:
        raise ValueError(_LLMEvaluatorPromptErrorMessage.EVALUATOR_CHOICES_MUST_BE_CATEGORICAL)
    evaluator_choices = [value.label for value in evaluator.output_config.values]
    if set(function_property_choices) != set(evaluator_choices):
        raise ValueError(
            _LLMEvaluatorPromptErrorMessage.EVALUATOR_CHOICES_MUST_MATCH_FUNCTION_PROPERTY_ENUM
        )
    # validate that "explanation" exists, and that it is a string property with description
    # only if output_config includes an explanation
    if evaluator.output_config.include_explanation:
        function_property_description = function_parameters.properties["explanation"].description
        if function_property_description is None:
            raise ValueError(_LLMEvaluatorPromptErrorMessage.EVALUATOR_EXPLANATION_MUST_BE_DEFINED)


class _EvaluatorPromptToolFunctionParametersProperty(BaseModel):
    type: Literal["string"]
    enum: Optional[list[str]] = Field(
        default=None,
        min_length=2,
    )
    description: str = Field(
        ...,
        min_length=1,
    )


class _EvaluatorPromptToolFunctionParameters(BaseModel):
    type: Literal["object"]
    properties: dict[str, _EvaluatorPromptToolFunctionParametersProperty] = Field(
        ...,
        min_length=1,
        # choice criteria property + explanation property
        max_length=2,  # this constraint can be lifted to add support for multi-criteria evaluators
    )
    required: list[str]

    @field_validator("required")
    @classmethod
    def check_required_values_are_unique(cls, values: list[str]) -> list[str]:
        if len(values) != len(set(values)):
            raise ValueError(_LLMEvaluatorPromptErrorMessage.REQUIRED_VALUES_MUST_BE_UNIQUE)
        return values

    @model_validator(mode="after")
    def check_all_properties_are_required(self) -> Self:
        defined_properties = set(self.properties)
        required_properties = set(self.required)
        if defined_properties - required_properties:
            raise ValueError(
                _LLMEvaluatorPromptErrorMessage.ALL_DEFINED_PROPERTIES_MUST_BE_REQUIRED
            )
        if required_properties - defined_properties:
            raise ValueError(
                _LLMEvaluatorPromptErrorMessage.ALL_REQUIRED_PROPERTIES_SHOULD_BE_DEFINED
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
    TOOL_MUST_BE_FUNCTION = "Evaluator prompts require a function tool"
    EVALUATOR_NAME_MUST_MATCH_FUNCTION_NAME = "Evaluator name must match the function name"
    EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION = (
        "Evaluator description must match the function description"
    )
    EVALUATOR_PARAMETERS_MUST_BE_VALID = "Evaluator parameters must be a valid JSON schema"
    REQUIRED_VALUES_MUST_BE_UNIQUE = "Required values must be unique"
    ALL_DEFINED_PROPERTIES_MUST_BE_REQUIRED = "All defined properties must be required"
    ALL_REQUIRED_PROPERTIES_SHOULD_BE_DEFINED = "All required properties must be defined"
    EVALUATOR_ANNOTATION_NAME_MUST_MATCH_FUNCTION_LABEL_PROPERTY_DESCRIPTION = (
        "Evaluator annotation name must match function parameters label property description"
    )
    EVALUATOR_CHOICES_MUST_MATCH_FUNCTION_PROPERTY_ENUM = (
        "Evaluator choices must match function parameters property enum"
    )
    EVALUATOR_CHOICES_MUST_BE_CATEGORICAL = (
        "Evaluator choices must be categorical (string property with enum and description)"
    )
    EVALUATOR_EXPLANATION_MUST_BE_DEFINED = (
        "Evaluator explanation must be defined (string property with description)"
        " when include_explanation is true in the output config"
    )
