from typing import TYPE_CHECKING, Any, Optional

import strawberry
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.types.Identifier import Identifier

if TYPE_CHECKING:
    from phoenix.server.api.mutations.annotation_config_mutations import (
        CategoricalAnnotationConfigInput,
    )


@strawberry.input
class EvaluatorInputMappingInput:
    literal_mapping: JSON = strawberry.field(default_factory=dict)
    """Direct key-value mappings to evaluator inputs."""
    path_mapping: JSON = strawberry.field(default_factory=dict)
    """JSONPath expressions to extract values from the evaluation context."""

    def to_dict(self) -> dict[str, Any]:
        return {
            "literal_mapping": self.literal_mapping,
            "path_mapping": self.path_mapping,
        }


@strawberry.input
class PlaygroundEvaluatorInput:
    id: GlobalID
    display_name: Identifier
    input_mapping: EvaluatorInputMappingInput = strawberry.field(
        default_factory=EvaluatorInputMappingInput
    )
    output_config: Optional[
        strawberry.LazyType[
            "CategoricalAnnotationConfigInput",
            "phoenix.server.api.mutations.annotation_config_mutations",
        ]
    ] = None
