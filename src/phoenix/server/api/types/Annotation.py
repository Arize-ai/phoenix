from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Any, Optional

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.server.api.context import Context

from .AnnotationSource import AnnotationSource
from .AnnotatorKind import AnnotatorKind

if TYPE_CHECKING:
    from .DecisionAnnotation import DecisionAnnotation
    from .User import User


@strawberry.interface
class AnnotationMetadataMixin:
    async def _metadata(self, info: Info[Context, None]) -> Any:
        raise NotImplementedError

    @strawberry.field(description="Metadata about the annotation.")  # type: ignore
    async def metadata(
        self,
        info: Info[Context, None],
    ) -> JSON:
        return JSON(await self._metadata(info))

    @strawberry.field(
        description=(
            "The decision judge's result, typed, when the metadata holds one in Phoenix's "
            "decision format; null otherwise."
        )
    )  # type: ignore
    async def decision(
        self,
        info: Info[Context, None],
    ) -> Optional[Annotated["DecisionAnnotation", strawberry.lazy(".DecisionAnnotation")]]:
        # Imported here: the decision clients import the playground clients, which import
        # the annotation types.
        from phoenix.server.api.types.DecisionAnnotation import (
            decision_annotation_from_metadata,
        )

        return decision_annotation_from_metadata(await self._metadata(info))


@strawberry.interface
class Annotation(AnnotationMetadataMixin):
    @strawberry.field(description="Name of the annotation, e.g. 'helpfulness' or 'relevance'.")  # type: ignore
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        raise NotImplementedError

    @strawberry.field(description="The kind of annotator that produced the annotation.")  # type: ignore
    async def annotator_kind(
        self,
        info: Info[Context, None],
    ) -> AnnotatorKind:
        raise NotImplementedError

    @strawberry.field(
        description="Value of the annotation in the form of a string, e.g. 'helpful' or 'not helpful'. Note that the label is not necessarily binary."  # noqa: E501
    )  # type: ignore
    async def label(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        raise NotImplementedError

    @strawberry.field(description="Value of the annotation in the form of a numeric score.")  # type: ignore
    async def score(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        raise NotImplementedError

    @strawberry.field(
        description="The annotator's explanation for the annotation result (i.e. score or label, or both) given to the subject."  # noqa: E501
    )  # type: ignore
    async def explanation(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        raise NotImplementedError

    @strawberry.field(description="The source of the annotation.")  # type: ignore
    async def source(
        self,
        info: Info[Context, None],
    ) -> AnnotationSource:
        raise NotImplementedError

    @strawberry.field(description="The identifier of the annotation.")  # type: ignore
    async def identifier(
        self,
        info: Info[Context, None],
    ) -> str:
        raise NotImplementedError

    @strawberry.field(description="The date and time the annotation was created.")  # type: ignore
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        raise NotImplementedError

    @strawberry.field(description="The date and time the annotation was last updated.")  # type: ignore
    async def updated_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        raise NotImplementedError

    @strawberry.field(description="The user that produced the annotation.")  # type: ignore
    async def user(
        self,
        info: Info[Context, None],
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        raise NotImplementedError
