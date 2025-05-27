from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class SpanAnnotationFilterCondition:
    names: Optional[list[str]] = UNSET
    sources: Optional[list[AnnotationSource]] = UNSET
    user_ids: Optional[list[Optional[GlobalID]]] = UNSET

    def __post_init__(self) -> None:
        if isinstance(self.names, list) and not self.names:
            raise BadRequest("names must be a non-empty list")
        if isinstance(self.sources, list) and not self.sources:
            raise BadRequest("sources must be a non-empty list")
        if isinstance(self.user_ids, list) and not self.user_ids:
            raise BadRequest("user ids must be a non-empty list")


@strawberry.input
class SpanAnnotationFilter:
    include: Optional[SpanAnnotationFilterCondition] = UNSET
    exclude: Optional[SpanAnnotationFilterCondition] = UNSET

    def __post_init__(self) -> None:
        if self.include is UNSET and self.exclude is UNSET:
            raise BadRequest("include and exclude cannot both be unset")


def satisfies_filter(span_annotation: models.SpanAnnotation, filter: SpanAnnotationFilter) -> bool:
    """
    Returns true if the span annotation satisfies the filter and false otherwise.
    """
    span_annotation_source = AnnotationSource(span_annotation.source)
    if include := filter.include:
        if include.names and span_annotation.name not in include.names:
            return False
        if include.sources and span_annotation_source not in include.sources:
            return False
        if include.user_ids:
            user_rowids = [
                from_global_id_with_expected_type(user_id, "User") if user_id is not None else None
                for user_id in include.user_ids
            ]
            if span_annotation.user_id not in user_rowids:
                return False
    if exclude := filter.exclude:
        if exclude.names and span_annotation.name in exclude.names:
            return False
        if exclude.sources and span_annotation_source in exclude.sources:
            return False
        if exclude.user_ids:
            user_rowids = [
                from_global_id_with_expected_type(user_id, "User") if user_id is not None else None
                for user_id in exclude.user_ids
            ]
            if span_annotation.user_id in user_rowids:
                return False
    return True
