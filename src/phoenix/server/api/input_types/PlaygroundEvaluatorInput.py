from typing import Optional

import strawberry
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.db.types.evaluators import InputMapping
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
