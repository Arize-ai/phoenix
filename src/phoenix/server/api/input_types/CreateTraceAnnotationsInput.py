from typing import Optional

import strawberry
from strawberry.scalars import JSON


@strawberry.input
class CreateTraceAnnotationsInput:
    trace_id: strawberry.ID
    name: str
    annotator_kind: str
    label: Optional[str] = None
    score: Optional[float] = None
    explanation: Optional[str] = None
    metadata: JSON = dict()
