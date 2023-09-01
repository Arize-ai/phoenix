from uuid import uuid4

from phoenix.core.traces import (
    _get_descendant_span_ids,
)


def test_get_descendant_span_ids() -> None:
    ids = [uuid4() for _ in range(6)]
    child_span_ids = {
        ids[1]: [ids[2], ids[3]],
        ids[2]: [ids[4]],
        ids[4]: [ids[5]],
    }
    assert set(_get_descendant_span_ids(ids[0], child_span_ids)) == set()
    assert set(_get_descendant_span_ids(ids[1], child_span_ids)) == set(ids[2:])
    assert set(_get_descendant_span_ids(ids[2], child_span_ids)) == set(ids[4:])
    assert set(_get_descendant_span_ids(ids[3], child_span_ids)) == set()
    assert set(_get_descendant_span_ids(ids[4], child_span_ids)) == set(ids[5:])
    assert set(_get_descendant_span_ids(ids[5], child_span_ids)) == set()
