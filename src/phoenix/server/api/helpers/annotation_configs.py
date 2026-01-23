from typing import Optional

from typing_extensions import assert_never

from phoenix.db.types.annotation_configs import (
    AnnotationConfigOverrideType,
    CategoricalAnnotationConfig,
    CategoricalAnnotationConfigOverride,
    CategoricalAnnotationValue,
    ContinuousAnnotationConfig,
    ContinuousAnnotationConfigOverride,
)
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import PlaygroundEvaluatorInput


def get_annotation_config_override(
    evaluator_input: PlaygroundEvaluatorInput,
) -> AnnotationConfigOverrideType | None:
    """
    Get the annotation config override from the PlaygroundEvaluatorInput.
    """

    if (
        evaluator_input.output_config_override is not None
        and evaluator_input.output_config_override.categorical
    ):
        cat = evaluator_input.output_config_override.categorical
        values = None
        if cat.values is not None:
            values = [CategoricalAnnotationValue(label=v.label, score=v.score) for v in cat.values]
        return CategoricalAnnotationConfigOverride(
            type="CATEGORICAL",
            optimization_direction=cat.optimization_direction,
            values=values,
        )
    elif (
        evaluator_input.output_config_override is not None
        and evaluator_input.output_config_override.continuous
    ):
        cont = evaluator_input.output_config_override.continuous
        return ContinuousAnnotationConfigOverride(
            type="CONTINUOUS",
            optimization_direction=cont.optimization_direction,
            lower_bound=cont.lower_bound,
            upper_bound=cont.upper_bound,
        )
    elif evaluator_input.output_config is not None:
        cat = evaluator_input.output_config
        values = None
        if cat.values is not None:
            values = [CategoricalAnnotationValue(label=v.label, score=v.score) for v in cat.values]
        return CategoricalAnnotationConfigOverride(
            type="CATEGORICAL",
            optimization_direction=cat.optimization_direction,
            values=values,
        )
    return None


def apply_overrides_to_annotation_config(
    *,
    annotation_config: CategoricalAnnotationConfig | ContinuousAnnotationConfig,
    annotation_config_override: AnnotationConfigOverrideType | None,
    name_override: str,
    description_override: str | None,
) -> CategoricalAnnotationConfig | ContinuousAnnotationConfig:
    """
    Apply overrides to an annotation config.
    """
    if isinstance(annotation_config, CategoricalAnnotationConfig):
        categorical_override: CategoricalAnnotationConfigOverride | None = None
        if annotation_config_override is not None:
            if isinstance(annotation_config_override, CategoricalAnnotationConfigOverride):
                categorical_override = annotation_config_override
            else:
                raise ValueError(
                    "Cannot apply a continuous annotation config override "
                    "to a categorical annotation config"
                )
        return merge_categorical_annotation_config(
            base=annotation_config,
            override=categorical_override,
            name=name_override,
            description_override=description_override,
        )
    elif isinstance(annotation_config, ContinuousAnnotationConfig):
        continuous_override: ContinuousAnnotationConfigOverride | None = None
        if annotation_config_override is not None:
            if isinstance(annotation_config_override, ContinuousAnnotationConfigOverride):
                continuous_override = annotation_config_override
            else:
                raise ValueError(
                    "Cannot apply a categorical annotation config override "
                    "to a continuous annotation config"
                )
        return merge_continuous_annotation_config(
            base=annotation_config,
            override=continuous_override,
            name=name_override,
            description_override=description_override,
        )
    assert_never(annotation_config)


def merge_categorical_annotation_config(
    base: CategoricalAnnotationConfig,
    override: Optional[CategoricalAnnotationConfigOverride],
    name: str,
    description_override: Optional[str],
) -> CategoricalAnnotationConfig:
    """
    Merge a base categorical annotation config with optional overrides.

    Args:
        base: The base CategoricalAnnotationConfig from the LLM evaluator
        override: Optional overrides from the dataset evaluator
        name: The name to use as the config name
        description_override: Optional description override

    Returns:
        A new CategoricalAnnotationConfig with overrides applied
    """
    values = base.values
    optimization_direction = base.optimization_direction
    description = base.description

    if override is not None:
        if override.values is not None:
            values = override.values
        if override.optimization_direction is not None:
            optimization_direction = override.optimization_direction

    if description_override is not None:
        description = description_override

    return CategoricalAnnotationConfig(
        type=base.type,
        name=name,
        description=description,
        optimization_direction=optimization_direction,
        values=values,
    )


def merge_continuous_annotation_config(
    base: ContinuousAnnotationConfig,
    override: Optional[ContinuousAnnotationConfigOverride],
    name: str,
    description_override: Optional[str],
) -> ContinuousAnnotationConfig:
    """
    Merge a base continuous annotation config with optional overrides.

    Args:
        base: The base ContinuousAnnotationConfig from the builtin evaluator
        override: Optional overrides from the dataset evaluator
        name: The name to use as the config name
        description_override: Optional description override

    Returns:
        A new ContinuousAnnotationConfig with overrides applied
    """
    optimization_direction = base.optimization_direction
    lower_bound = base.lower_bound
    upper_bound = base.upper_bound
    description = base.description

    if override is not None:
        if override.optimization_direction is not None:
            optimization_direction = override.optimization_direction
        if override.lower_bound is not None:
            lower_bound = override.lower_bound
        if override.upper_bound is not None:
            upper_bound = override.upper_bound

    if description_override is not None:
        description = description_override

    return ContinuousAnnotationConfig(
        type=base.type,
        name=name,
        description=description,
        optimization_direction=optimization_direction,
        lower_bound=lower_bound,
        upper_bound=upper_bound,
    )
