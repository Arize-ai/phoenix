from typing import TYPE_CHECKING, Literal, Optional

from pydantic import (
    BaseModel,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)
from typing_extensions import Self, assert_never

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    AnnotationConfigType,
    CategoricalAnnotationConfig,
    ContinuousAnnotationConfig,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptResponseFormat,
    PromptToolChoiceOneOrMore,
    PromptToolChoiceSpecificFunctionTool,
    PromptToolFunction,
    PromptTools,
)

if TYPE_CHECKING:
    from phoenix.server.api.evaluators import BaseEvaluator
    from phoenix.server.api.input_types.AnnotationConfigInput import (
        AnnotationConfigInput,
    )
    from phoenix.server.api.input_types.PlaygroundEvaluatorInput import PlaygroundEvaluatorInput


def validate_evaluator_prompt_and_configs(
    *,
    prompt_tools: Optional[PromptTools],
    prompt_response_format: Optional[PromptResponseFormat],
    evaluator_output_configs: list[CategoricalAnnotationConfig],
    evaluator_description: Optional[str] = None,
) -> None:
    """
    Validate that prompt tool definitions are consistent with evaluator output configs.

    Each output config must have a corresponding tool definition matched by name.
    The tool's label enum must match the config's values, and the tool's label
    description must match the config's name (annotation name).
    """
    if prompt_response_format is not None:
        raise ValueError(_LLMEvaluatorPromptErrorMessage.RESPONSE_FORMAT_NOT_SUPPORTED)
    if prompt_tools is None:
        raise ValueError(_LLMEvaluatorPromptErrorMessage.TOOLS_REQUIRED)
    if len(prompt_tools.tools) != len(evaluator_output_configs):
        raise ValueError(_LLMEvaluatorPromptErrorMessage.TOOL_COUNT_MUST_MATCH_CONFIG_COUNT)
    if not isinstance(
        prompt_tools.tool_choice, (PromptToolChoiceOneOrMore, PromptToolChoiceSpecificFunctionTool)
    ):
        raise ValueError(_LLMEvaluatorPromptErrorMessage.TOOL_CHOICE_REQUIRED)
    if isinstance(prompt_tools.tool_choice, PromptToolChoiceSpecificFunctionTool):
        if prompt_tools.tool_choice.function_name != prompt_tools.tools[0].function.name:
            raise ValueError(
                _LLMEvaluatorPromptErrorMessage.TOOL_CHOICE_SPECIFIC_FUNCTION_NAME_MUST_MATCH_DEFINED_FUNCTION_NAME
            )

    # Build a lookup of tool definitions by function name
    tools_by_name: dict[str, PromptToolFunction] = {}
    for tool in prompt_tools.tools:
        if not isinstance(tool, PromptToolFunction):
            assert_never(tool)
        tools_by_name[tool.function.name] = tool

    # Validate each config against its matched tool
    for config in evaluator_output_configs:
        config_name = config.name or ""
        prompt_tool = tools_by_name.get(config_name)
        if prompt_tool is None:
            raise ValueError(
                f"No tool definition found matching output config name '{config_name}'"
            )
        _validate_tool_and_config(
            prompt_tool=prompt_tool,
            evaluator_annotation_name=config_name,
            evaluator_output_config=config,
            evaluator_description=evaluator_description,
        )


def _validate_tool_and_config(
    *,
    prompt_tool: PromptToolFunction,
    evaluator_annotation_name: str,
    evaluator_output_config: CategoricalAnnotationConfig,
    evaluator_description: Optional[str] = None,
) -> None:
    """Validate a single tool definition against its matched output config."""
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
    output_configs = llm_evaluator.output_configs
    if not output_configs:
        raise ValueError("LLM evaluator must have at least one output config")
    # Validate all configs are categorical
    categorical_configs: list[CategoricalAnnotationConfig] = []
    for output_config in output_configs:
        if not isinstance(output_config, CategoricalAnnotationConfig):
            raise ValueError("LLM evaluator output config must be a CategoricalAnnotationConfig")
        categorical_configs.append(output_config)
    validate_evaluator_prompt_and_configs(
        prompt_tools=prompt_version.tools,
        prompt_response_format=prompt_version.response_format,
        evaluator_output_configs=categorical_configs,
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
    TOOL_COUNT_MUST_MATCH_CONFIG_COUNT = (
        "Number of prompt tool definitions must match number of output configs"
    )
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


# ============================================================================
# Multi-output evaluator validation helpers
# ============================================================================


def get_config_name(
    config: "AnnotationConfigInput",
) -> str:
    """
    Extract the name from an AnnotationConfigInput.

    Args:
        config: The annotation config input to extract the name from.

    Returns:
        The name of the config.

    Raises:
        ValueError: If no annotation config variant is provided.
    """
    import strawberry

    if config.categorical is not None and config.categorical is not strawberry.UNSET:
        return str(config.categorical.name)
    elif config.continuous is not None and config.continuous is not strawberry.UNSET:
        return str(config.continuous.name)
    elif config.freeform is not None and config.freeform is not strawberry.UNSET:
        return str(config.freeform.name)
    else:
        raise ValueError("No annotation config provided")


def validate_unique_config_names(
    configs: "list[AnnotationConfigInput]",
) -> None:
    """
    Validate that all config names in the list are unique.

    Args:
        configs: List of annotation config inputs to validate.

    Raises:
        ValueError: If duplicate config names are found.
    """
    config_names = [get_config_name(c) for c in configs]
    if len(config_names) != len(set(config_names)):
        duplicates = [name for name in config_names if config_names.count(name) > 1]
        raise ValueError(f"Config names must be unique. Duplicates found: {set(duplicates)}")


def validate_min_one_config(
    configs: "list[AnnotationConfigInput]",
) -> None:
    """
    Validate that at least one config exists in the list.

    Args:
        configs: List of annotation config inputs to validate.

    Raises:
        ValueError: If the config list is empty.
    """
    if not configs:
        raise ValueError("At least one output config is required")


class LLMEvaluatorOutputConfigs(BaseModel):
    """Validated output configs for LLM evaluators (categorical only)."""

    configs: list[CategoricalAnnotationConfig] = Field(min_length=1)

    @field_validator("configs")
    @classmethod
    def check_unique_names(
        cls, configs: list[CategoricalAnnotationConfig]
    ) -> list[CategoricalAnnotationConfig]:
        names = [c.name for c in configs]
        if len(names) != len(set(names)):
            duplicates = [n for n in names if names.count(n) > 1]
            raise ValueError(f"Config names must be unique. Duplicates found: {set(duplicates)}")
        return configs

    @classmethod
    def from_inputs(cls, inputs: "list[AnnotationConfigInput]") -> "LLMEvaluatorOutputConfigs":
        """Convert Strawberry AnnotationConfigInput list to validated LLM evaluator configs."""
        import strawberry

        from phoenix.db.types.annotation_configs import (
            AnnotationType,
            CategoricalAnnotationValue,
        )

        configs: list[CategoricalAnnotationConfig] = []
        for input_ in inputs:
            if input_.categorical is not None and input_.categorical is not strawberry.UNSET:
                cat = input_.categorical
                configs.append(
                    CategoricalAnnotationConfig(
                        type=AnnotationType.CATEGORICAL.value,
                        name=cat.name,
                        description=cat.description,
                        optimization_direction=cat.optimization_direction,
                        values=[
                            CategoricalAnnotationValue(label=v.label, score=v.score)
                            for v in cat.values
                        ],
                    )
                )
            else:
                raise ValueError(
                    "LLM evaluators only support categorical output configs. "
                    "Non-categorical config found."
                )
        return cls(configs=configs)


def get_evaluator_output_configs(
    evaluator_input: "PlaygroundEvaluatorInput",
    evaluator: "BaseEvaluator",
) -> list[CategoricalAnnotationConfig | ContinuousAnnotationConfig]:
    """
    Get the output configs for an evaluator run. Uses configs from the evaluator input
    if provided, otherwise falls back to the base evaluator's stored output configs.

    Returns only categorical or continuous configs (the types supported by evaluators).
    Raises ValueError if any freeform configs are encountered.
    """
    from phoenix.db.types.annotation_configs import FreeformAnnotationConfig

    configs: list[AnnotationConfigType]
    if evaluator_input.output_configs:
        from phoenix.server.api.mutations.evaluator_mutations import (
            _convert_output_config_inputs_to_pydantic,
        )

        configs = _convert_output_config_inputs_to_pydantic(evaluator_input.output_configs)
    else:
        configs = list(evaluator.output_configs)

    narrowed: list[CategoricalAnnotationConfig | ContinuousAnnotationConfig] = []
    for config in configs:
        if isinstance(config, FreeformAnnotationConfig):
            raise ValueError(
                "Freeform annotation configs are not supported as evaluator output configs"
            )
        narrowed.append(config)
    return narrowed
