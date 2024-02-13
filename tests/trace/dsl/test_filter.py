import ast
from collections import namedtuple
from itertools import count, islice
from random import random

import phoenix.trace.v1 as pb
import pytest
from google.protobuf.wrappers_pb2 import DoubleValue, StringValue
from openinference.semconv.trace import SpanAttributes
from phoenix.trace.dsl.filter import SpanFilter, _validate_expression

LLM_TOKEN_COUNT_TOTAL = SpanAttributes.LLM_TOKEN_COUNT_TOTAL


def test_span_filter() -> None:
    key = LLM_TOKEN_COUNT_TOTAL
    Span = namedtuple("Span", "attributes name parent_id")
    span_0 = Span({key: 0}, 0, "2")
    span_1 = Span({key: 1}, 1, None)
    span_2 = Span({}, None, "3")
    spans = [span_0, span_1, span_2]
    assert list(filter(SpanFilter(), spans)) == spans  # no op
    assert list(filter(SpanFilter("parent_id is None"), spans)) == [span_1]
    assert list(filter(SpanFilter("parent_id is not None"), spans)) == [span_0, span_2]
    assert list(filter(SpanFilter("parent_id == '3'"), spans)) == [spans[2]]
    assert list(filter(SpanFilter("parent_id in ('2', '3')"), spans)) == [span_0, span_2]
    assert list(filter(SpanFilter("parent_id in ['2']"), spans)) == [span_0]
    for k in (key, "name"):
        assert list(filter(SpanFilter(f"{k} > 0.5"), spans)) == [span_1]
        assert list(filter(SpanFilter(f"{k} < 0.5"), spans)) == [span_0]
        assert list(filter(SpanFilter(f"{k} >= 0.5"), spans)) == [span_1]
        assert list(filter(SpanFilter(f"{k} <= 0.5"), spans)) == [span_0]
        assert list(filter(SpanFilter(f"{k} == 0.5"), spans)) == []
        assert list(filter(SpanFilter(f"{k} != 0.5"), spans)) == [span_0, span_1]
        assert list(filter(SpanFilter(f"{k} is not None"), spans)) == [span_0, span_1]
        assert list(filter(SpanFilter(f"{k} is None"), spans)) == [span_2]


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


def test_span_filter_by_eval(spans, evals, eval_name):
    spans = list(islice(spans, 3))

    sf = SpanFilter(f"evals['{eval_name}'].score < 0.5", evals=evals)
    assert list(filter(sf, spans)) == [spans[0]]

    sf = SpanFilter(f"evals['{eval_name}'].label == '1'", evals=evals)
    assert list(filter(sf, spans)) == [spans[1]]

    sf = SpanFilter(f"evals['{eval_name}'].score is None", evals=evals)
    assert list(filter(sf, spans)) == [spans[2]]

    sf = SpanFilter(f"evals['{eval_name}'].label is None", evals=evals)
    assert list(filter(sf, spans)) == [spans[0], spans[2]]

    sf = SpanFilter(f"evals['{eval_name}'].score is not None", evals=evals)
    assert list(filter(sf, spans)) == [spans[0], spans[1]]

    sf = SpanFilter(f"evals['{eval_name}'].label is not None", evals=evals)
    assert list(filter(sf, spans)) == [spans[1]]

    # evals is None
    sf = SpanFilter(f"evals['{eval_name}'].score < 0.5", evals=None)
    assert list(filter(sf, spans)) == []

    # non-existent evaluation name
    sf = SpanFilter(f"evals['{random()}'].score < 0.5", evals=evals)
    assert list(filter(sf, spans)) == []

    # non-existent evaluation name
    sf = SpanFilter(f"evals['{random()}'].label == '1'", evals=evals)
    assert list(filter(sf, spans)) == []


def test_span_filter_by_eval_exceptions(spans, evals, eval_name):
    with pytest.raises(SyntaxError):
        # no valid eval names
        SpanFilter(f"evals['{eval_name}'].score < 0.5", evals=evals, valid_eval_names=[])
    with pytest.raises(SyntaxError):
        # invalid attribute
        SpanFilter(f"evals['{eval_name}'].scor < 0.5", evals=evals)
    with pytest.raises(SyntaxError):
        # misspelled evals
        SpanFilter(f"eval['{eval_name}'].score < 0.5", evals=evals)
    with pytest.raises(SyntaxError):
        # non-string eval name
        SpanFilter("evals[123].score < 0.5", evals=evals)


Span = namedtuple("Span", "context")
Context = namedtuple("Context", "span_id")
Evals = namedtuple("Evals", "get_span_evaluation")


@pytest.fixture
def evals(eval_name):
    result0 = pb.Evaluation.Result(score=DoubleValue(value=0))
    result1 = pb.Evaluation.Result(score=DoubleValue(value=1), label=StringValue(value="1"))
    evaluations = {eval_name: {0: pb.Evaluation(result=result0), 1: pb.Evaluation(result=result1)}}
    return Evals(lambda span_id, name: evaluations.get(name, {}).get(span_id))


@pytest.fixture
def eval_name():
    return "correctness"


@pytest.fixture
def spans():
    return (Span(context=Context(i)) for i in count())
