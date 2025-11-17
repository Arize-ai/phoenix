import strawberry
from strawberry.relay import GlobalID
from strawberry.scalars import JSON


@strawberry.input
class EvaluatorInputMapping:
    literal_mapping: JSON = strawberry.field(default_factory=dict)
    """Direct key-value mappings to evaluator inputs."""
    path_mapping: JSON = strawberry.field(default_factory=dict)
    """JSONPath expressions to extract values from the evaluation context."""


@strawberry.input
class PlaygroundEvaluatorInput:
    id: GlobalID
    input_mapping: EvaluatorInputMapping = strawberry.field(
        default_factory=EvaluatorInputMapping
    )
