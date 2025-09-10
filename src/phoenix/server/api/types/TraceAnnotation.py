from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry import Private
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind

from .AnnotationSource import AnnotationSource
from .User import User, to_gql_user

if TYPE_CHECKING:
    from .Trace import Trace


@strawberry.type
class TraceAnnotation(Node):
    id_attr: NodeID[int]
    user_id: Private[Optional[int]]
    name: str
    annotator_kind: AnnotatorKind
    label: Optional[str]
    score: Optional[float]
    explanation: Optional[str]
    metadata: JSON
    trace_rowid: Private[int]
    identifier: str
    source: AnnotationSource

    @strawberry.field
    async def trace(self) -> Annotated["Trace", strawberry.lazy(".Trace")]:
        from phoenix.server.api.types.Trace import Trace

        return Trace(trace_rowid=self.trace_rowid)

    @strawberry.field
    async def user(
        self,
        info: Info[Context, None],
    ) -> Optional[User]:
        if self.user_id is None:
            return None
        user = await info.context.data_loaders.users.load(self.user_id)
        if user is None:
            return None
        return to_gql_user(user)


def to_gql_trace_annotation(
    annotation: models.TraceAnnotation,
) -> TraceAnnotation:
    """
    Converts an ORM trace annotation to a GraphQL TraceAnnotation.
    """
    return TraceAnnotation(
        id_attr=annotation.id,
        user_id=annotation.user_id,
        trace_rowid=annotation.trace_rowid,
        name=annotation.name,
        annotator_kind=AnnotatorKind(annotation.annotator_kind),
        label=annotation.label,
        score=annotation.score,
        explanation=annotation.explanation,
        metadata=annotation.metadata_,
        identifier=annotation.identifier,
        source=AnnotationSource(annotation.source),
    )
