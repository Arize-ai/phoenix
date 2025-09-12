from typing import Optional

import strawberry
from strawberry import Private
from strawberry.relay import GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind

from .AnnotationSource import AnnotationSource
from .User import User, to_gql_user


@strawberry.type
class ProjectSessionAnnotation(Node):
    id_attr: NodeID[int]
    user_id: Private[Optional[int]]
    name: str
    annotator_kind: AnnotatorKind
    label: Optional[str]
    score: Optional[float]
    explanation: Optional[str]
    metadata: JSON
    _project_session_id: Private[Optional[int]]
    identifier: str
    source: AnnotationSource

    @strawberry.field
    async def project_session_id(self) -> GlobalID:
        from phoenix.server.api.types.ProjectSession import ProjectSession

        return GlobalID(type_name=ProjectSession.__name__, node_id=str(self._project_session_id))

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


def to_gql_project_session_annotation(
    annotation: models.ProjectSessionAnnotation,
) -> ProjectSessionAnnotation:
    """
    Converts an ORM projectSession annotation to a GraphQL ProjectSessionAnnotation.
    """
    return ProjectSessionAnnotation(
        id_attr=annotation.id,
        user_id=annotation.user_id,
        _project_session_id=annotation.project_session_id,
        name=annotation.name,
        annotator_kind=AnnotatorKind(annotation.annotator_kind),
        label=annotation.label,
        score=annotation.score,
        explanation=annotation.explanation,
        metadata=JSON(annotation.metadata_),
        identifier=annotation.identifier,
        source=AnnotationSource(annotation.source),
    )
