from datetime import datetime
from math import isfinite
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context

from .Annotation import Annotation
from .AnnotationSource import AnnotationSource
from .AnnotatorKind import AnnotatorKind

if TYPE_CHECKING:
    from .Span import Span
    from .User import User


@strawberry.type
class DocumentAnnotation(Node, Annotation):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.DocumentAnnotation]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("DocumentAnnotation ID mismatch")

    @strawberry.field(description="Name of the annotation, e.g. 'helpfulness' or 'relevance'.")  # type: ignore
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.document_annotation_fields.load(
                (self.id, models.DocumentAnnotation.name),
            )
        return val

    @strawberry.field(description="The kind of annotator that produced the annotation.")  # type: ignore
    async def annotator_kind(
        self,
        info: Info[Context, None],
    ) -> AnnotatorKind:
        if self.db_record:
            val = self.db_record.annotator_kind
        else:
            val = await info.context.data_loaders.document_annotation_fields.load(
                (self.id, models.DocumentAnnotation.annotator_kind),
            )
        return AnnotatorKind(val)

    @strawberry.field(
        description="Value of the annotation in the form of a string, e.g. "
        "'helpful' or 'not helpful'. Note that the label is not necessarily binary."
    )  # type: ignore
    async def label(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.label
        else:
            val = await info.context.data_loaders.document_annotation_fields.load(
                (self.id, models.DocumentAnnotation.label),
            )
        return val

    @strawberry.field(
        description="Value of the annotation in the form of a numeric score.",
    )  # type: ignore
    async def score(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            val = self.db_record.score
        else:
            val = await info.context.data_loaders.document_annotation_fields.load(
                (self.id, models.DocumentAnnotation.score),
            )
        return val if val is not None and isfinite(val) else None

    @strawberry.field(
        description="The annotator's explanation for the annotation result (i.e. "
        "score or label, or both) given to the subject."
    )  # type: ignore
    async def explanation(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.explanation
        else:
            val = await info.context.data_loaders.document_annotation_fields.load(
                (self.id, models.DocumentAnnotation.explanation),
            )
        return val

    @strawberry.field(description="The metadata associated with the annotation.")  # type: ignore
    async def metadata(
        self,
        info: Info[Context, None],
    ) -> JSON:
        if self.db_record:
            val = self.db_record.metadata_
        else:
            val = await info.context.data_loaders.document_annotation_fields.load(
                (self.id, models.DocumentAnnotation.metadata_),
            )
        return val

    @strawberry.field(description="The position of the annotation in the document.")  # type: ignore
    async def document_position(
        self,
        info: Info[Context, None],
    ) -> int:
        if self.db_record:
            val = self.db_record.document_position
        else:
            val = await info.context.data_loaders.document_annotation_fields.load(
                (self.id, models.DocumentAnnotation.document_position),
            )
        return val

    @strawberry.field(description="The identifier of the annotation.")  # type: ignore
    async def identifier(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            val = self.db_record.identifier
        else:
            val = await info.context.data_loaders.document_annotation_fields.load(
                (self.id, models.DocumentAnnotation.identifier),
            )
        return val

    @strawberry.field(description="The source of the annotation.")  # type: ignore
    async def source(
        self,
        info: Info[Context, None],
    ) -> AnnotationSource:
        if self.db_record:
            val = self.db_record.source
        else:
            val = await info.context.data_loaders.document_annotation_fields.load(
                (self.id, models.DocumentAnnotation.source),
            )
        return AnnotationSource(val)

    @strawberry.field(description="The date and time when the annotation was created.")  # type: ignore
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.document_annotation_fields.load(
                (self.id, models.DocumentAnnotation.created_at),
            )
        return val

    @strawberry.field(description="The date and time when the annotation was last updated.")  # type: ignore
    async def updated_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.updated_at
        else:
            val = await info.context.data_loaders.document_annotation_fields.load(
                (self.id, models.DocumentAnnotation.updated_at),
            )
        return val

    @strawberry.field(description="The span associated with the annotation.")  # type: ignore
    async def span(
        self,
        info: Info[Context, None],
    ) -> Annotated["Span", strawberry.lazy(".Span")]:
        if self.db_record:
            span_rowid = self.db_record.span_rowid
        else:
            span_rowid = await info.context.data_loaders.document_annotation_fields.load(
                (self.id, models.DocumentAnnotation.span_rowid),
            )
        from .Span import Span

        return Span(id=span_rowid)

    @strawberry.field(description="The user that produced the annotation.")  # type: ignore
    async def user(
        self,
        info: Info[Context, None],
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        if self.db_record:
            user_id = self.db_record.user_id
        else:
            user_id = await info.context.data_loaders.document_annotation_fields.load(
                (self.id, models.DocumentAnnotation.user_id),
            )
        if user_id is None:
            return None
        from .User import User

        return User(id=user_id)
