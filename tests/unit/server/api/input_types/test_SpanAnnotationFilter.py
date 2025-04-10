import pytest

from phoenix.db.models import SpanAnnotation
from phoenix.server.api.input_types.SpanAnnotationFilter import (
    SpanAnnotationFilter,
    SpanAnnotationFilterCondition,
    satisfies_filter,
)


@pytest.mark.parametrize(
    "span_annotation, filter, satisfies",
    [
        pytest.param(
            SpanAnnotation(
                span_rowid=1,
                name="span-annotation-name",
                label="label",
                score=1.0,
                explanation="explanation",
                metadata_={},
                annotator_kind="HUMAN",
                source="API",
            ),
            SpanAnnotationFilter(),
            True,
            id="empty-filter",
        ),
        pytest.param(
            SpanAnnotation(
                span_rowid=1,
                name="span-annotation-name",
                label="label",
                score=1.0,
                explanation="explanation",
                metadata_={},
                annotator_kind="HUMAN",
                source="API",
            ),
            SpanAnnotationFilter(include=SpanAnnotationFilterCondition(name="missing-name")),
            False,
            id="missing-name",
        ),
    ],
)
def test_satisfies_filter(
    span_annotation: SpanAnnotation,
    filter: SpanAnnotationFilter,
    satisfies: bool,
) -> None:
    assert satisfies_filter(span_annotation, filter) == satisfies
