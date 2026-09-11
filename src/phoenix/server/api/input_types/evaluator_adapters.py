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
