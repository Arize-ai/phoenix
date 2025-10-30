from math import isfinite
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind

from .AnnotationSource import AnnotationSource

if TYPE_CHECKING:
    from .Trace import Trace
    from .User import User


@strawberry.type
class TraceAnnotation(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.TraceAnnotation]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("TraceAnnotation ID mismatch")

    @strawberry.field(description="Name of the annotation, e.g. 'helpfulness' or 'relevance'.")  # type: ignore
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.trace_annotation_fields.load(
                (self.id, models.TraceAnnotation.name),
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
            val = await info.context.data_loaders.trace_annotation_fields.load(
                (self.id, models.TraceAnnotation.annotator_kind),
            )
        return AnnotatorKind(val)

    @strawberry.field(
        description="Value of the annotation in the form of a string, e.g. 'helpful' or 'not helpful'. Note that the label is not necessarily binary."  # noqa: E501
    )  # type: ignore
    async def label(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.label
        else:
            val = await info.context.data_loaders.trace_annotation_fields.load(
                (self.id, models.TraceAnnotation.label),
            )
        return val

    @strawberry.field(description="Value of the annotation in the form of a numeric score.")  # type: ignore
    async def score(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            val = self.db_record.score
        else:
            val = await info.context.data_loaders.trace_annotation_fields.load(
                (self.id, models.TraceAnnotation.score),
            )
        return val if val is not None and isfinite(val) else None

    @strawberry.field(
        description="The annotator's explanation for the annotation result (i.e. score or label, or both) given to the subject."  # noqa: E501
    )  # type: ignore
    async def explanation(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.explanation
        else:
            val = await info.context.data_loaders.trace_annotation_fields.load(
                (self.id, models.TraceAnnotation.explanation),
            )
        return val

    @strawberry.field(description="Metadata about the annotation.")  # type: ignore
    async def metadata(
        self,
        info: Info[Context, None],
    ) -> JSON:
        if self.db_record:
            val = self.db_record.metadata_
        else:
            val = await info.context.data_loaders.trace_annotation_fields.load(
                (self.id, models.TraceAnnotation.metadata_),
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
            val = await info.context.data_loaders.trace_annotation_fields.load(
                (self.id, models.TraceAnnotation.identifier),
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
            val = await info.context.data_loaders.trace_annotation_fields.load(
                (self.id, models.TraceAnnotation.source),
            )
        return AnnotationSource(val)

    @strawberry.field(description="The trace associated with the annotation.")  # type: ignore
    async def trace(
        self,
        info: Info[Context, None],
    ) -> Annotated["Trace", strawberry.lazy(".Trace")]:
        if self.db_record:
            trace_rowid = self.db_record.trace_rowid
        else:
            trace_rowid = await info.context.data_loaders.trace_annotation_fields.load(
                (self.id, models.TraceAnnotation.trace_rowid),
            )
        from .Trace import Trace

        return Trace(id=trace_rowid)

    @strawberry.field(description="The user that produced the annotation.")  # type: ignore
    async def user(
        self,
        info: Info[Context, None],
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        if self.db_record:
            user_id = self.db_record.user_id
        else:
            user_id = await info.context.data_loaders.trace_annotation_fields.load(
                (self.id, models.TraceAnnotation.user_id),
            )
        if user_id is None:
            return None
        from .User import User

        return User(id=user_id)
