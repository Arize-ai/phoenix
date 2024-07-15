from typing import Optional

import strawberry
from strawberry import Private
from strawberry.relay import GlobalID, Node, NodeID
from strawberry.scalars import JSON

from phoenix.db import models
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind


@strawberry.type
class TraceAnnotation(Node):
    id_attr: NodeID[int]
    name: str
    annotator_kind: AnnotatorKind
    label: Optional[str]
    score: Optional[float]
    explanation: Optional[str]
    metadata: JSON
    trace_rowid: Private[Optional[int]]

    @strawberry.field
    async def trace_id(self) -> GlobalID:
        from phoenix.server.api.types.Trace import Trace

        return GlobalID(type_name=Trace.__name__, node_id=str(self.trace_rowid))


def to_gql_trace_annotation(
    annotation: models.TraceAnnotation,
) -> TraceAnnotation:
    """
    Converts an ORM trace annotation to a GraphQL TraceAnnotation.
    """
    return TraceAnnotation(
        id_attr=annotation.id,
        trace_rowid=annotation.trace_rowid,
        name=annotation.name,
        annotator_kind=AnnotatorKind(annotation.annotator_kind),
        label=annotation.label,
        score=annotation.score,
        explanation=annotation.explanation,
        metadata=annotation.metadata_,
    )
