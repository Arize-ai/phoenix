from binascii import hexlify
from collections import defaultdict, namedtuple
from itertools import count, islice, permutations
from typing import DefaultDict, Dict, Iterable, Iterator, Set, Tuple

import opentelemetry.proto.trace.v1.trace_pb2 as otlp
import pytest
from openinference.semconv.trace import SpanAttributes
from opentelemetry.proto.common.v1.common_pb2 import AnyValue, KeyValue
from phoenix.core.project import Project, _Spans
from phoenix.trace.attributes import get_attribute_value
from phoenix.trace.otel import decode_otlp_span
from phoenix.trace.schemas import ComputedAttributes


@pytest.mark.parametrize("permutation", list(permutations(range(5))))
def test_ingestion(
    otlp_trace: Tuple[otlp.Span, ...],
    permutation: Tuple[int, ...],
    child_ids: DefaultDict[str, Set[str]],
    parent_ids: Dict[str, str],
) -> None:
    project = Project()
    _spans = project._spans._spans
    trace_id = _id_str(otlp_trace[0].trace_id)
    expected_token_count_total = 0
    ingested_ids = set()
    for i, s in enumerate(permutation):
        otlp_span = otlp_trace[s]
        project.add_span(decode_otlp_span(otlp_span))

        assert len(list(project.get_trace(trace_id))) == i + 1, f"{i=}, {s=}"
        assert project.span_count() == i + 1, f"{i=}, {s=}"

        assert _id_str(otlp_span.span_id) in _spans, f"{i=}, {s=}"
        latest_span = next(project.get_spans(span_ids=[_id_str(otlp_span.span_id)]))
        expected_token_count_total += get_attribute_value(
            latest_span.attributes,
            SpanAttributes.LLM_TOKEN_COUNT_TOTAL,
        )
        assert project.token_count_total == expected_token_count_total, f"{i=}, {s=}"
        ingested_ids.add(latest_span.context.span_id)

        # Check that all cumulative values are correct at all times. We do this by summing
        # up values from all connected descendants. A descendant is connected if all parents
        # in between have been ingested. A disconnected descendant does not propagate its value
        # across a missing parent.
        for span_id in ingested_ids.intersection(child_ids.keys()):
            span = next(project.get_spans(span_ids=[span_id]))
            assert span[ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_TOTAL] == get_attribute_value(
                span.attributes, SpanAttributes.LLM_TOKEN_COUNT_TOTAL
            ) + sum(
                get_attribute_value(span.attributes, SpanAttributes.LLM_TOKEN_COUNT_TOTAL)
                for span in project.get_spans(
                    span_ids=list(_connected_descendant_ids(span_id, child_ids, ingested_ids))
                )
            ), f"{i=}, {s=}, {span_id=}"

        # Check that root spans are correctly designated: a root span is a span whose parent
        # has not been ingested.
        assert set(span.context.span_id for span in project.get_spans(root_spans_only=True)) == {
            span_id for span_id in ingested_ids if parent_ids.get(span_id) not in ingested_ids
        }


def test_get_descendant_span_ids(spans) -> None:
    spans = list(islice(spans, 6))
    span_ids = [span.context.span_id for span in spans]
    mock = _Spans()
    mock._child_spans.update(
        {
            span_ids[1]: {spans[2], spans[3]},
            span_ids[2]: {spans[4]},
            span_ids[4]: {spans[5]},
        }
    )
    assert set(mock.get_descendant_spans(span_ids[0])) == set()
    assert set(mock.get_descendant_spans(span_ids[1])) == set(spans[2:])
    assert set(mock.get_descendant_spans(span_ids[2])) == set(spans[4:])
    assert set(mock.get_descendant_spans(span_ids[3])) == set()
    assert set(mock.get_descendant_spans(span_ids[4])) == set(spans[5:])
    assert set(mock.get_descendant_spans(span_ids[5])) == set()


Span = namedtuple("Span", "context")
Context = namedtuple("Context", "span_id")


@pytest.fixture
def spans():
    return (Span(context=Context(i)) for i in count())


@pytest.fixture(scope="module")
def otlp_trace() -> Tuple[otlp.Span, ...]:
    def kwargs(v):
        return {
            "start_time_unix_nano": 1_000_000_000,
            "end_time_unix_nano": 2_000_000_000,
            "trace_id": b"\x00",
            "attributes": [
                KeyValue(
                    key=SpanAttributes.LLM_TOKEN_COUNT_TOTAL,
                    value=AnyValue(int_value=v),
                )
            ],
        }

    # parent-child relationship:
    # span_0
    # └── span_1
    #     ├── span_2
    #     │   └── span_3
    #     └── span_4
    span_0 = otlp.Span(span_id=b"\x00", **kwargs(1234))
    span_1 = otlp.Span(span_id=b"\x01", parent_span_id=span_0.span_id, **kwargs(2345))
    span_2 = otlp.Span(span_id=b"\x02", parent_span_id=span_1.span_id, **kwargs(3456))
    span_3 = otlp.Span(span_id=b"\x03", parent_span_id=span_2.span_id, **kwargs(4567))
    span_4 = otlp.Span(span_id=b"\x04", parent_span_id=span_1.span_id, **kwargs(5678))
    return span_0, span_1, span_2, span_3, span_4


@pytest.fixture(scope="module")
def child_ids(otlp_trace: Iterable[otlp.Span]) -> DefaultDict[str, Set[str]]:
    ans = defaultdict(set)
    for span in otlp_trace:
        if span.parent_span_id:
            parent_span_id = _id_str(span.parent_span_id)
            span_id = _id_str(span.span_id)
            ans[parent_span_id].add(span_id)
    return ans


@pytest.fixture(scope="module")
def parent_ids(child_ids: DefaultDict[str, Set[str]]) -> Dict[str, str]:
    return {
        child_span_id: parent_span_id
        for parent_span_id, child_span_ids in child_ids.items()
        for child_span_id in child_span_ids
    }


def _connected_descendant_ids(
    span_id: str,
    child_ids: DefaultDict[str, Set[str]],
    ingested_ids: Set[str],
) -> Iterator[str]:
    # A descendant is connected if all parents in between have been ingested.
    for id_ in child_ids.get(span_id) or ():
        if id_ not in ingested_ids:
            continue
        yield id_
        yield from _connected_descendant_ids(id_, child_ids, ingested_ids)


def _id_str(id_: bytes) -> str:
    return hexlify(id_).decode()
