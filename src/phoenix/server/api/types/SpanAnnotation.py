from typing import Optional

import strawberry
from strawberry import Private
from strawberry.relay import GlobalID, Node, NodeID
from strawberry.scalars import JSON

from phoenix.db import models

from .Annotation import Annotation
from .AnnotatorKind import AnnotatorKind


@strawberry.type
class SpanAnnotation(Node, Annotation):
    id_attr: NodeID[int]
    annotator_kind: AnnotatorKind
    metadata: JSON
    span_rowid: Private[Optional[int]]

    @strawberry.field
    async def span_id(self) -> GlobalID:
        from phoenix.server.api.types.Span import Span

        return GlobalID(type_name=Span.__name__, node_id=str(self.span_rowid))


def to_gql_span_annotation(
    annotation: models.SpanAnnotation,
) -> SpanAnnotation:
    """
    Converts an ORM span annotation to a GraphQL SpanAnnotation.
    """
    return SpanAnnotation(
        id_attr=annotation.id,
        span_rowid=annotation.span_rowid,
        name=annotation.name,
        annotator_kind=AnnotatorKind(annotation.annotator_kind),
        label=annotation.label,
        score=annotation.score,
        explanation=annotation.explanation,
        metadata=annotation.metadata_,
    )
