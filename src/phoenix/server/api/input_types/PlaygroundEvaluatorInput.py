from typing import Mapping, Optional

import strawberry
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.db.types.evaluators import InputMapping, validate_jsonpath
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.AnnotationConfigInput import (
    AnnotationConfigOverrideInput,
    CategoricalAnnotationConfigOverrideInput,
)
from phoenix.server.api.types.Identifier import Identifier


@strawberry.input
class EvaluatorInputMappingInput:
    literal_mapping: JSON = strawberry.field(default_factory=dict)
    """Direct key-value mappings to evaluator inputs."""
    path_mapping: JSON = strawberry.field(default_factory=dict)
    """JSONPath expressions to extract values from the evaluation context."""

    def __post_init__(self) -> None:
        if not isinstance(self.path_mapping, Mapping):
            raise BadRequest("path_mapping must be a dictionary")
        for key, path in self.path_mapping.items():
            if not isinstance(path, str):
                raise BadRequest(
                    f"Invalid JSONPath expression for key '{key}': {path} is not a string"
                )
            try:
                validate_jsonpath(path)
            except ValueError as e:
                raise BadRequest(f"Invalid JSONPath expression for key '{key}': {e}")

    def to_orm(self) -> InputMapping:
        """Convert to database InputMapping type."""
        return InputMapping(
            literal_mapping=self.literal_mapping,
            path_mapping=self.path_mapping,
        )


@strawberry.input
class PlaygroundEvaluatorInput:
    id: GlobalID
    name: Identifier
    description: Optional[str] = None
    input_mapping: EvaluatorInputMappingInput = strawberry.field(
        default_factory=EvaluatorInputMappingInput
    )
    output_config: Optional[CategoricalAnnotationConfigOverrideInput] = None
    output_config_override: Optional[AnnotationConfigOverrideInput] = None
