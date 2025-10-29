from math import isfinite
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.relay import GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind

from .Annotation import Annotation
from .AnnotationSource import AnnotationSource

if TYPE_CHECKING:
    from .ProjectSession import ProjectSession
    from .User import User


@strawberry.type
class ProjectSessionAnnotation(Node, Annotation):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.ProjectSessionAnnotation]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("ProjectSessionAnnotation ID mismatch")

    @strawberry.field(description="Name of the annotation, e.g. 'helpfulness' or 'relevance'.")  # type: ignore
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.project_session_annotation_fields.load(
                (self.id, models.ProjectSessionAnnotation.name),
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
            val = await info.context.data_loaders.project_session_annotation_fields.load(
                (self.id, models.ProjectSessionAnnotation.annotator_kind),
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
            val = await info.context.data_loaders.project_session_annotation_fields.load(
                (self.id, models.ProjectSessionAnnotation.label),
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
            val = await info.context.data_loaders.project_session_annotation_fields.load(
                (self.id, models.ProjectSessionAnnotation.score),
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
            val = await info.context.data_loaders.project_session_annotation_fields.load(
                (self.id, models.ProjectSessionAnnotation.explanation),
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
            val = await info.context.data_loaders.project_session_annotation_fields.load(
                (self.id, models.ProjectSessionAnnotation.metadata_),
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
            val = await info.context.data_loaders.project_session_annotation_fields.load(
                (self.id, models.ProjectSessionAnnotation.identifier),
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
            val = await info.context.data_loaders.project_session_annotation_fields.load(
                (self.id, models.ProjectSessionAnnotation.source),
            )
        return AnnotationSource(val)

    @strawberry.field(description="The project session associated with the annotation.")  # type: ignore
    async def project_session_id(
        self,
        info: Info[Context, None],
    ) -> GlobalID:
        from phoenix.server.api.types.ProjectSession import ProjectSession

        if self.db_record:
            project_session_id = self.db_record.project_session_id
        else:
            project_session_id = (
                await info.context.data_loaders.project_session_annotation_fields.load(
                    (self.id, models.ProjectSessionAnnotation.project_session_id),
                )
            )
        return GlobalID(type_name=ProjectSession.__name__, node_id=str(project_session_id))

    @strawberry.field(description="The project session associated with the annotation.")  # type: ignore
    async def project_session(
        self,
        info: Info[Context, None],
    ) -> Annotated["ProjectSession", strawberry.lazy(".ProjectSession")]:
        if self.db_record:
            project_session_id = self.db_record.project_session_id
        else:
            project_session_id = (
                await info.context.data_loaders.project_session_annotation_fields.load(
                    (self.id, models.ProjectSessionAnnotation.project_session_id),
                )
            )
        from .ProjectSession import ProjectSession

        return ProjectSession(id=project_session_id)

    @strawberry.field(description="The user that produced the annotation.")  # type: ignore
    async def user(
        self,
        info: Info[Context, None],
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        if self.db_record:
            user_id = self.db_record.user_id
        else:
            user_id = await info.context.data_loaders.project_session_annotation_fields.load(
                (self.id, models.ProjectSessionAnnotation.user_id),
            )
        if user_id is None:
            return None
        from .User import User

        return User(id=user_id)
