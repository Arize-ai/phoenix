from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class SpanAnnotationFilterCondition:
    name: Optional[str] = UNSET
    source: Optional[AnnotationSource] = UNSET
    user_ids: Optional[list[GlobalID]] = UNSET


@strawberry.input
class SpanAnnotationFilter:
    include: Optional[SpanAnnotationFilterCondition] = UNSET
    exclude: Optional[SpanAnnotationFilterCondition] = UNSET


def satisfies_filter(span_annotation: models.SpanAnnotation, filter: SpanAnnotationFilter) -> bool:
    """
    Returns true if the span annotation satisfies the filter and false otherwise.
    """
    span_annotation_source = AnnotationSource(span_annotation.source)
    if include := filter.include:
        if include.name is not UNSET and span_annotation.name != include.name:
            return False
        if include.source is not UNSET and span_annotation_source is not include.source:
            return False
        if include.user_ids:
            user_rowids = set(
                from_global_id_with_expected_type(user_id, "User") for user_id in include.user_ids
            )
            if span_annotation.user_id not in user_rowids:
                return False
    if exclude := filter.exclude:
        if exclude.name is not UNSET and span_annotation.name == exclude.name:
            return False
        if exclude.source is not UNSET and span_annotation_source is exclude.source:
            return False
        if exclude.user_ids:
            user_rowids = set(
                from_global_id_with_expected_type(user_id, "User") for user_id in exclude.user_ids
            )
            if span_annotation.user_id in user_rowids:
                return False
    return True
