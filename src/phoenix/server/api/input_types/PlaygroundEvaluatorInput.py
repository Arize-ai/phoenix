from typing import Any

import strawberry
from strawberry.relay import GlobalID
from strawberry.scalars import JSON


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
    display_name: str
    input_mapping: EvaluatorInputMappingInput = strawberry.field(
        default_factory=EvaluatorInputMappingInput
    )
