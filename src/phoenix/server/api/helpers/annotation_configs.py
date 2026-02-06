from collections.abc import Sequence
from typing import Optional

from typing_extensions import assert_never

from phoenix.db.types.annotation_configs import (
    AnnotationConfigOverrideType,
    AnnotationConfigType,
    CategoricalAnnotationConfig,
    CategoricalAnnotationConfigOverride,
    CategoricalAnnotationValue,
    ContinuousAnnotationConfig,
    ContinuousAnnotationConfigOverride,
    FreeformAnnotationConfig,
)
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import PlaygroundEvaluatorInput


def get_annotation_config_overrides_dict(
    evaluator_input: PlaygroundEvaluatorInput,
) -> dict[str, AnnotationConfigOverrideType] | None:
    """
    Convert PlaygroundEvaluatorInput's output_config_overrides to a dict keyed by config name.
    """
    if evaluator_input.output_config_overrides is None:
        return None
    result: dict[str, AnnotationConfigOverrideType] = {}
    for named_override in evaluator_input.output_config_overrides:
        if named_override.override.categorical is not None:
            cat = named_override.override.categorical
            values = None
            if cat.values is not None:
                values = [
                    CategoricalAnnotationValue(label=v.label, score=v.score) for v in cat.values
                ]
            result[named_override.name] = CategoricalAnnotationConfigOverride(
                type="CATEGORICAL",
                optimization_direction=cat.optimization_direction,
                values=values,
            )
        elif named_override.override.continuous is not None:
            cont = named_override.override.continuous
            result[named_override.name] = ContinuousAnnotationConfigOverride(
                type="CONTINUOUS",
                optimization_direction=cont.optimization_direction,
                lower_bound=cont.lower_bound,
                upper_bound=cont.upper_bound,
            )
    return result if result else None


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


def merge_single_config(
    config: AnnotationConfigType,
    override: AnnotationConfigOverrideType,
) -> AnnotationConfigType:
    """
    Merge a single annotation config with an override.

    Uses the config's existing name and description (no overrides for those fields).
    Freeform configs are returned unchanged since there are no freeform overrides.

    Args:
        config: The base annotation config
        override: The override to apply

    Returns:
        A new annotation config with the override applied

    Raises:
        ValueError: If the config has no name or if the override type doesn't match
    """
    if isinstance(config, FreeformAnnotationConfig):
        # Freeform configs have no override type, return as-is
        return config

    # Ensure config has a name for merging
    if config.name is None:
        raise ValueError("Cannot merge config without a name")

    if isinstance(config, CategoricalAnnotationConfig):
        if not isinstance(override, CategoricalAnnotationConfigOverride):
            raise ValueError(
                "Cannot apply a continuous annotation config override "
                "to a categorical annotation config"
            )
        return merge_categorical_annotation_config(
            base=config,
            override=override,
            name=config.name,
            description_override=None,
        )
    elif isinstance(config, ContinuousAnnotationConfig):
        if not isinstance(override, ContinuousAnnotationConfigOverride):
            raise ValueError(
                "Cannot apply a categorical annotation config override "
                "to a continuous annotation config"
            )
        return merge_continuous_annotation_config(
            base=config,
            override=override,
            name=config.name,
            description_override=None,
        )
    assert_never(config)


def merge_configs_with_overrides(
    base_configs: Sequence[AnnotationConfigType],
    overrides: Optional[dict[str, AnnotationConfigOverrideType]],
) -> list[AnnotationConfigType]:
    """
    Merge base configs with overrides by config name.

    For each base config, looks up an override by the config's name field.
    If an override exists, merges it with the base config.
    If no override exists, uses the base config unchanged.
    Configs without names are passed through unchanged.

    Args:
        base_configs: Sequence of base annotation configs
        overrides: Optional dict of overrides keyed by config name

    Returns:
        List of merged annotation configs
    """
    if not overrides:
        return list(base_configs)

    result: list[AnnotationConfigType] = []
    for config in base_configs:
        config_name = config.name
        if config_name is not None:
            override = overrides.get(config_name)
            if override:
                result.append(merge_single_config(config, override))
            else:
                result.append(config)
        else:
            # Configs without names cannot be looked up, pass through unchanged
            result.append(config)
    return result
