from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class SpanAnnotationFilterCondition:
    names: Optional[list[str]] = UNSET
    sources: Optional[list[AnnotationSource]] = UNSET
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
        if include.names is not UNSET and span_annotation.name not in include.names:
            return False
        if include.sources is not UNSET and span_annotation_source not in include.sources:
            return False
        if include.user_ids:
            user_rowids = [
                from_global_id_with_expected_type(user_id, "User") for user_id in include.user_ids
            ]
            if span_annotation.user_id not in user_rowids:
                return False
    if exclude := filter.exclude:
        if exclude.names is not UNSET and span_annotation.name in exclude.names:
            return False
        if exclude.sources is not UNSET and span_annotation_source in exclude.sources:
            return False
        if exclude.user_ids:
            user_rowids = [
                from_global_id_with_expected_type(user_id, "User") for user_id in exclude.user_ids
            ]
            if span_annotation.user_id in user_rowids:
                return False
    return True
