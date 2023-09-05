import ast
from collections import namedtuple

import pytest
from phoenix.trace.filter import Filter, _validate_expression
from phoenix.trace.semantic_conventions import LLM_TOKEN_COUNT_TOTAL


def test_span_filter() -> None:
    key = LLM_TOKEN_COUNT_TOTAL
    Span = namedtuple("Span", "attributes name parent_id")
    span_0 = Span({key: 0}, 0, "2")
    span_1 = Span({key: 1}, 1, None)
    span_2 = Span({}, None, "3")
    spans = [span_0, span_1, span_2]
    assert list(filter(Filter("parent_id is None"), spans)) == [span_1]
    assert list(filter(Filter("parent_id is not None"), spans)) == [span_0, span_2]
    assert list(filter(Filter("parent_id == '3'"), spans)) == [spans[2]]
    assert list(filter(Filter("parent_id in ('2', '3')"), spans)) == [span_0, span_2]
    assert list(filter(Filter("parent_id in ['2']"), spans)) == [span_0]
    for k in (key, "name"):
        assert list(filter(Filter(f"{k} > 0.5"), spans)) == [span_1]
        assert list(filter(Filter(f"{k} < 0.5"), spans)) == [span_0]
        assert list(filter(Filter(f"{k} >= 0.5"), spans)) == [span_1]
        assert list(filter(Filter(f"{k} <= 0.5"), spans)) == [span_0]
        assert list(filter(Filter(f"{k} == 0.5"), spans)) == []
        assert list(filter(Filter(f"{k} != 0.5"), spans)) == [span_0, span_1]
        assert list(filter(Filter(f"{k} is not None"), spans)) == [span_0, span_1]
        assert list(filter(Filter(f"{k} is None"), spans)) == [span_2]


def test_ast_validate_expression() -> None:
    _validate("a is None")
    _validate("a > b")
    _validate("a > b and c < -d")
    _validate("a > b + c")
    _validate("a > b and (c < d or e == f) and g >= h")
    with pytest.raises(SyntaxError):
        _validate("sqrt(x)")
    with pytest.raises(SyntaxError):
        _validate("abs(x) and x")
    with pytest.raises(SyntaxError):
        _validate("{} == {}")


def _validate(source: str):
    _validate_expression(ast.parse(source, mode="eval"), source)
