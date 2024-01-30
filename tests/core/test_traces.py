from collections import namedtuple
from itertools import count, islice

import pytest
from phoenix.core.traces import (
    Traces,
)


class MockTraces(Traces):
    def _start_consumer(self) -> None:
        pass


def test_get_descendant_span_ids(spans) -> None:
    spans = list(islice(spans, 6))
    span_ids = [span.context.span_id for span in spans]
    mock = MockTraces()
    mock._child_spans.update(
        {
            span_ids[1]: {spans[2], spans[3]},
            span_ids[2]: {spans[4]},
            span_ids[4]: {spans[5]},
        }
    )
    assert set(mock._get_descendant_spans(span_ids[0])) == set()
    assert set(mock._get_descendant_spans(span_ids[1])) == set(spans[2:])
    assert set(mock._get_descendant_spans(span_ids[2])) == set(spans[4:])
    assert set(mock._get_descendant_spans(span_ids[3])) == set()
    assert set(mock._get_descendant_spans(span_ids[4])) == set(spans[5:])
    assert set(mock._get_descendant_spans(span_ids[5])) == set()


Span = namedtuple("Span", "context")
Context = namedtuple("Context", "span_id")


@pytest.fixture
def spans():
    return (Span(context=Context(i)) for i in count())
