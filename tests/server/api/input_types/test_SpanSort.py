from phoenix.server.api.input_types.SpanSort import (
    _SPAN_COLUMN_TO_ORM_EXPR_MAP,
    SpanColumn,
)


def test_span_column_has_orm_expr():
    assert set(SpanColumn) == set(_SPAN_COLUMN_TO_ORM_EXPR_MAP)
