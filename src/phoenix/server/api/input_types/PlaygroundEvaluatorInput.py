from typing import Optional

import strawberry
from strawberry.relay import GlobalID
from strawberry.scalars import JSON


@strawberry.input
class PlaygroundEvaluatorInput:
    id: GlobalID
    """The ID of the evaluator to use."""
    input_mapping: Optional[JSON] = strawberry.field(default_factory=dict)
    """The input mapping to the evaluator."""
