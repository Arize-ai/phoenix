"""Convert GraphQL evaluator inputs to validated output configurations."""

from strawberry import UNSET

from phoenix.db.types.annotation_configs import (
    AnnotationType,
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    FreeformOutputConfig,
    OutputConfigType,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.evaluators import LLMEvaluatorOutputConfigs
from phoenix.server.api.input_types.AnnotationConfigInput import AnnotationConfigInput


def _output_config_input_to_pydantic(input: AnnotationConfigInput) -> OutputConfigType:
    """Convert an annotation input to a named evaluator output configuration."""
    if input.categorical is not None and input.categorical is not UNSET:
        cat = input.categorical
        return CategoricalOutputConfig(
            type=AnnotationType.CATEGORICAL.value,
            name=cat.name,
            description=cat.description,
            optimization_direction=cat.optimization_direction,
            values=[CategoricalAnnotationValue(label=v.label, score=v.score) for v in cat.values],
        )
    elif input.continuous is not None and input.continuous is not UNSET:
        cont = input.continuous
        return ContinuousOutputConfig(
            type=AnnotationType.CONTINUOUS.value,
            name=cont.name,
            description=cont.description,
            optimization_direction=cont.optimization_direction,
            lower_bound=cont.lower_bound,
            upper_bound=cont.upper_bound,
        )
    elif input.freeform is not None and input.freeform is not UNSET:
        free = input.freeform
        return FreeformOutputConfig(
            type=AnnotationType.FREEFORM.value,
            name=free.name,
            description=free.description,
            optimization_direction=free.optimization_direction,
            thresholds=[free.threshold] if free.threshold is not None else None,
            lower_bound=free.lower_bound,
            upper_bound=free.upper_bound,
        )
    raise BadRequest("Invalid output config input")


def convert_output_config_inputs_to_pydantic(
    configs: list[AnnotationConfigInput],
) -> list[OutputConfigType]:
    """Convert annotation inputs to evaluator output configurations."""
    return [_output_config_input_to_pydantic(c) for c in configs]


def get_config_name(
    config: AnnotationConfigInput,
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
    if config.categorical is not None and config.categorical is not UNSET:
        return str(config.categorical.name)
    elif config.continuous is not None and config.continuous is not UNSET:
        return str(config.continuous.name)
    elif config.freeform is not None and config.freeform is not UNSET:
        return str(config.freeform.name)
    else:
        raise ValueError("No annotation config provided")


def validate_unique_config_names(
    configs: list[AnnotationConfigInput],
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


def llm_evaluator_output_configs_from_inputs(
    inputs: list[AnnotationConfigInput],
) -> LLMEvaluatorOutputConfigs:
    """Convert Strawberry AnnotationConfigInput list to validated LLM evaluator configs."""
    configs: list[CategoricalOutputConfig] = []
    for input_ in inputs:
        if input_.categorical is not None and input_.categorical is not UNSET:
            cat = input_.categorical
            configs.append(
                CategoricalOutputConfig(
                    type=AnnotationType.CATEGORICAL.value,
                    name=cat.name,
                    description=cat.description,
                    optimization_direction=cat.optimization_direction,
                    values=[
                        CategoricalAnnotationValue(label=v.label, score=v.score) for v in cat.values
                    ],
                )
            )
        else:
            raise ValueError(
                "LLM evaluators only support categorical output configs. "
                "Non-categorical config found."
            )
    return LLMEvaluatorOutputConfigs(configs=configs)
