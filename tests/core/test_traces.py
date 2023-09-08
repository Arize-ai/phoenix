from uuid import uuid4

from phoenix.core.traces import (
    Traces,
)


class MockTraces(Traces):
    def _start_consumer(self) -> None:
        pass


def test_get_descendant_span_ids() -> None:
    span_ids = [uuid4() for _ in range(6)]
    mock = MockTraces()
    mock._child_span_ids = {
        span_ids[1]: [span_ids[2], span_ids[3]],
        span_ids[2]: [span_ids[4]],
        span_ids[4]: [span_ids[5]],
    }
    assert set(mock.get_descendant_span_ids(span_ids[0])) == set()
    assert set(mock.get_descendant_span_ids(span_ids[1])) == set(span_ids[2:])
    assert set(mock.get_descendant_span_ids(span_ids[2])) == set(span_ids[4:])
    assert set(mock.get_descendant_span_ids(span_ids[3])) == set()
    assert set(mock.get_descendant_span_ids(span_ids[4])) == set(span_ids[5:])
    assert set(mock.get_descendant_span_ids(span_ids[5])) == set()
