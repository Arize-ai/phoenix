from collections import namedtuple
from random import random

import phoenix.trace.v1 as pb
import pytest
from google.protobuf.wrappers_pb2 import DoubleValue, StringValue
from openinference.semconv.trace import SpanAttributes
from phoenix.core.project import WrappedSpan
from phoenix.server.api.input_types.SpanSort import EvalAttr, EvalResultKey, SpanColumn, SpanSort
from phoenix.server.api.types.SortDir import SortDir


@pytest.mark.parametrize(
    "col", [SpanColumn.endTime, SpanColumn.latencyMs, SpanColumn.tokenCountTotal]
)
def test_sort_by_col(spans, col):
    span0, span1, span2, span3, span4 = spans
    sort = SpanSort(col=col, dir=SortDir.desc)
    assert list(sort(spans)) == [span4, span2, span0, span1, span3]


@pytest.mark.parametrize("eval_attr", list(EvalAttr))
def test_sort_by_eval(spans, evals, eval_name, eval_attr):
    span0, span1, span2 = spans[:3]

    eval_result_key = EvalResultKey(name=eval_name, attr=eval_attr)
    sort = SpanSort(eval_result_key=eval_result_key, dir=SortDir.desc)
    assert list(sort([span0, span2, span1], evals)) == [span1, span0, span2]

    # non-existent evaluation name
    no_op_key = EvalResultKey(name=random(), attr=eval_attr)
    no_op_sort = SpanSort(eval_result_key=no_op_key, dir=SortDir.desc)
    assert list(no_op_sort([span2, span0, span1], evals)) == [span2, span0, span1]


Span = namedtuple("Span", "context end_time attributes")
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
    _spans = []
    for i in range(5):
        span = WrappedSpan(
            Span(
                context=Context(i),
                end_time=None if i % 2 else i,
                attributes={} if i % 2 else {SpanAttributes.LLM_TOKEN_COUNT_TOTAL: i},
            )
        )
        if i % 2 == 0:
            span[SpanColumn.latencyMs.value] = i
        _spans.append(span)
    return _spans
