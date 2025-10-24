from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry import Private
from strawberry.relay import GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context

from .Annotation import Annotation
from .AnnotationSource import AnnotationSource
from .AnnotatorKind import AnnotatorKind

if TYPE_CHECKING:
    from .User import User


@strawberry.type
class SpanAnnotation(Node, Annotation):
    id_attr: NodeID[int]
    user_id: Private[Optional[int]]
    annotator_kind: AnnotatorKind
    metadata: JSON
    span_rowid: Private[Optional[int]]
    source: AnnotationSource
    identifier: str

    @strawberry.field
    async def span_id(self) -> GlobalID:
        from phoenix.server.api.types.Span import Span

        return GlobalID(type_name=Span.__name__, node_id=str(self.span_rowid))

    @strawberry.field
    async def user(
        self,
        info: Info[Context, None],
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        if self.user_id is None:
            return None
        from .User import User

        return User(id=self.user_id)


def to_gql_span_annotation(
    annotation: models.SpanAnnotation,
) -> SpanAnnotation:
    """
    Converts an ORM span annotation to a GraphQL SpanAnnotation.
    """
    return SpanAnnotation(
        id_attr=annotation.id,
        user_id=annotation.user_id,
        span_rowid=annotation.span_rowid,
        name=annotation.name,
        annotator_kind=AnnotatorKind(annotation.annotator_kind),
        label=annotation.label,
        score=annotation.score,
        explanation=annotation.explanation,
        metadata=annotation.metadata_,
        source=AnnotationSource(annotation.source),
        identifier=annotation.identifier,
        created_at=annotation.created_at,
        updated_at=annotation.updated_at,
    )
