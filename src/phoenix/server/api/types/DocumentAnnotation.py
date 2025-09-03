from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry import Private
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.interceptor import GqlValueMediator

from .Annotation import Annotation
from .AnnotationSource import AnnotationSource
from .AnnotatorKind import AnnotatorKind
from .User import User, to_gql_user

if TYPE_CHECKING:
    from .Span import Span


@strawberry.type
class DocumentAnnotation(Node, Annotation):
    id_attr: NodeID[int]
    user_id: Private[Optional[int]]
    name: str = strawberry.field(
        description="Name of the annotation, e.g. 'helpfulness' or 'relevance'."
    )
    annotator_kind: AnnotatorKind
    label: Optional[str] = strawberry.field(
        description="Value of the annotation in the form of a string, e.g. "
        "'helpful' or 'not helpful'. Note that the label is not necessarily binary."
    )
    score: Optional[float] = strawberry.field(
        description="Value of the annotation in the form of a numeric score.",
        default=GqlValueMediator(),
    )
    explanation: Optional[str] = strawberry.field(
        description="The annotator's explanation for the annotation result (i.e. "
        "score or label, or both) given to the subject."
    )
    metadata: JSON
    document_position: int
    span_rowid: Private[int]
    identifier: str
    source: AnnotationSource
    created_at: datetime = strawberry.field(
        description="The date and time when the annotation was created."
    )
    updated_at: datetime = strawberry.field(
        description="The date and time when the annotation was last updated."
    )

    @strawberry.field
    async def span(self) -> Annotated["Span", strawberry.lazy(".Span")]:
        from phoenix.server.api.types.Span import Span

        return Span(span_rowid=self.span_rowid)

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


def to_gql_document_annotation(
    annotation: models.DocumentAnnotation,
) -> DocumentAnnotation:
    return DocumentAnnotation(
        id_attr=annotation.id,
        user_id=annotation.user_id,
        name=annotation.name,
        annotator_kind=AnnotatorKind(annotation.annotator_kind),
        label=annotation.label,
        score=annotation.score,
        explanation=annotation.explanation,
        metadata=annotation.metadata_,
        span_rowid=annotation.span_rowid,
        source=AnnotationSource(annotation.source),
        identifier=annotation.identifier,
        document_position=annotation.document_position,
        created_at=annotation.created_at,
        updated_at=annotation.updated_at,
    )
