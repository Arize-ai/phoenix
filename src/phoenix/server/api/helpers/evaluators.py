"""Validate evaluator output configurations and their prompt contracts."""

from typing import Literal, NamedTuple, Optional, Sequence

from pydantic import (
    BaseModel,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID
from typing_extensions import Self

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalOutputConfig,
    OutputConfigType,
    as_output_configs,
)
from phoenix.db.types.prompts import (
    PromptResponseFormat,
    PromptToolChoiceOneOrMore,
    PromptToolChoiceSpecificFunctionTool,
    PromptToolFunction,
    PromptTools,
)


def validate_evaluator_prompt_and_configs(
    *,
    prompt_tools: Optional[PromptTools],
    prompt_response_format: Optional[PromptResponseFormat],
    evaluator_output_configs: list[CategoricalOutputConfig],
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
        if not prompt_tools.tools or not isinstance(prompt_tools.tools[0], PromptToolFunction):
            raise ValueError(_LLMEvaluatorPromptErrorMessage.FUNCTION_TOOLS_REQUIRED)
        if prompt_tools.tool_choice.function_name != prompt_tools.tools[0].function.name:
            raise ValueError(
                _LLMEvaluatorPromptErrorMessage.TOOL_CHOICE_SPECIFIC_FUNCTION_NAME_MUST_MATCH_DEFINED_FUNCTION_NAME
            )

    # Build a lookup of tool definitions by function name
    tools_by_name: dict[str, PromptToolFunction] = {}
    for tool in prompt_tools.tools:
        if not isinstance(tool, PromptToolFunction):
            raise ValueError(_LLMEvaluatorPromptErrorMessage.FUNCTION_TOOLS_REQUIRED)
        tools_by_name[tool.function.name] = tool

    # Validate each config against its matched tool
    for config in evaluator_output_configs:
        config_name = config.name
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
    evaluator_output_config: CategoricalOutputConfig,
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
        # The judge model reads the tool function's description as its instruction, while the
        # UI shows the evaluator's description as what the evaluator does, so the two must be
        # the same string or the UI describes an instruction the judge isn't running.
        # If the evaluator description is not None, it must match the function description.
        # The function may have an empty string as its description, as required by the Anthropic API
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
    categorical_configs: list[CategoricalOutputConfig] = []
    for output_config in output_configs:
        if not isinstance(output_config, CategoricalOutputConfig):
            raise ValueError("LLM evaluator output config must be a CategoricalAnnotationConfig")
        categorical_configs.append(output_config)
    validate_evaluator_prompt_and_configs(
        prompt_tools=prompt_version.tools,
        prompt_response_format=prompt_version.response_format,
        evaluator_output_configs=categorical_configs,
        evaluator_description=llm_evaluator.description,
    )


class IncompatibleDatasetOverride(NamedTuple):
    """Dataset override that cannot be served by an evaluator prompt version."""

    dataset_evaluator_id: str
    binding_name: str
    dataset_name: str


def format_incompatible_dataset_overrides(
    overrides: Sequence[IncompatibleDatasetOverride],
) -> str:
    """Format incompatible overrides with binding and dataset names for conflict errors."""
    return ", ".join(
        f"binding '{override.binding_name}' on dataset '{override.dataset_name}' "
        f"({override.dataset_evaluator_id})"
        for override in overrides
    )


async def incompatible_dataset_overrides(
    session: AsyncSession,
    llm_evaluator: models.LLMEvaluator,
    prompt_version: models.PromptVersion,
) -> list[IncompatibleDatasetOverride]:
    """Return dataset binding overrides this version cannot serve.

    Bindings without overrides follow the evaluator's own outputs and need no separate check.
    Each result includes the GlobalID and display names used in compatibility errors.
    """
    bindings = (
        await session.execute(
            select(models.DatasetEvaluators, models.Dataset.name)
            .join(models.Dataset, models.Dataset.id == models.DatasetEvaluators.dataset_id)
            .where(
                models.DatasetEvaluators.evaluator_id == llm_evaluator.id,
                or_(
                    models.DatasetEvaluators.output_configs.is_not(None),
                    models.DatasetEvaluators.description.is_not(None),
                ),
            )
        )
    ).all()
    incompatible: list[IncompatibleDatasetOverride] = []
    for binding, dataset_name in bindings:
        configs = (
            as_output_configs(binding.output_configs)
            if binding.output_configs is not None
            else list(llm_evaluator.output_configs)
        )
        try:
            validate_evaluator_prompt_and_configs(
                prompt_tools=prompt_version.tools,
                prompt_response_format=prompt_version.response_format,
                evaluator_output_configs=LLMEvaluatorOutputConfigs.model_validate(
                    {"configs": configs}
                ).configs,
                evaluator_description=(
                    binding.description
                    if binding.description is not None
                    else llm_evaluator.description
                ),
            )
        except (ValueError, ValidationError):
            incompatible.append(
                IncompatibleDatasetOverride(
                    dataset_evaluator_id=str(GlobalID("DatasetEvaluator", str(binding.id))),
                    binding_name=binding.name.root,
                    dataset_name=dataset_name,
                )
            )
    return incompatible


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
    FUNCTION_TOOLS_REQUIRED = "Evaluator prompts require function tools"
    EXACTLY_ONE_TOOL_REQUIRED = "Evaluator prompts require exactly one tool"
    TOOL_COUNT_MUST_MATCH_CONFIG_COUNT = (
        "Number of prompt tool definitions must match number of output configs"
    )
    TOOL_CHOICE_REQUIRED = "Evaluator prompts must require a tool choice"
    FUNCTION_TOOLS_REQUIRED = "Evaluator prompts require function tools"
    TOOL_CHOICE_SPECIFIC_FUNCTION_NAME_MUST_MATCH_DEFINED_FUNCTION_NAME = (
        "Evaluator tool choice specific function name must match defined function name"
    )
    EVALUATOR_DESCRIPTION_MUST_MATCH_FUNCTION_DESCRIPTION = (
        "Evaluator description must match the function description; create a prompt version "
        "whose tool description matches, then PATCH prompt and description together"
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


def result_annotation_names(
    evaluator_name: str,
    output_configs: Sequence[OutputConfigType],
) -> list[str]:
    """The annotation names an evaluator's results are stored under, in config order.

    A single output config writes under the evaluator's own name; multiple
    write under "{evaluator_name}.{config_name}". This is the storage contract
    `BaseEvaluator.evaluate` implements and the online-eval executor validates
    against; the frontend mirrors it in useProjectEvaluatorResultAnnotations.ts.
    An evaluator with no output configs still writes under its own name.
    """
    if len(output_configs) > 1:
        return [f"{evaluator_name}.{config.name}" for config in output_configs]
    return [evaluator_name]


class LLMEvaluatorOutputConfigs(BaseModel):
    """Validated output configs for LLM evaluators (categorical only)."""

    configs: list[CategoricalOutputConfig] = Field(min_length=1)

    @field_validator("configs")
    @classmethod
    def check_unique_names(
        cls, configs: list[CategoricalOutputConfig]
    ) -> list[CategoricalOutputConfig]:
        names = [c.name for c in configs]
        if len(names) != len(set(names)):
            duplicates = [n for n in names if names.count(n) > 1]
            raise ValueError(f"Config names must be unique. Duplicates found: {set(duplicates)}")
        return configs


def require_categorical_output_configs(configs: Sequence[OutputConfigType]) -> None:
    """LLM evaluators answer through a label-choosing tool, so every output must be categorical."""
    if any(not isinstance(config, CategoricalOutputConfig) for config in configs):
        raise ValueError(
            "LLM evaluators only support categorical output configs. Non-categorical config found."
        )
