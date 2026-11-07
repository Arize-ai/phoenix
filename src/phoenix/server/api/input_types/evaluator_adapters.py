"""Convert GraphQL evaluator inputs to validated output configurations."""

from pydantic import ValidationError

from phoenix.db.types.annotation_configs import OutputConfigType
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.AnnotationConfigInput import AnnotationConfigInput


def convert_output_config_inputs_to_pydantic(
    configs: list[AnnotationConfigInput],
) -> list[OutputConfigType]:
    """Convert annotation inputs to output configurations; invalid inputs are client errors."""
    try:
        return [config.to_output_config() for config in configs]
    except (ValueError, ValidationError) as error:
        raise BadRequest(str(error))
