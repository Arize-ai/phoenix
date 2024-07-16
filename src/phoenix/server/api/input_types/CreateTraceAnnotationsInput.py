from typing import Optional

import strawberry
from strawberry.relay import GlobalID
from strawberry.scalars import JSON


@strawberry.input
class CreateTraceAnnotationsInput:
    trace_id: GlobalID
    name: str
    annotator_kind: str
    label: Optional[str] = None
    score: Optional[float] = None
    explanation: Optional[str] = None
    metadata: JSON = strawberry.field(default_factory=dict)
