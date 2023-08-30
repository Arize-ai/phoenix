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


# def test_acumulate() -> None:
#     span_ids = list("ABCDEF")
#     span_values = pd.Series(
#         [1, 1, None, 1, 1, None],
#         index=span_ids,
#     )
#     span_parent_ids = pd.Series(
#         [None, "A", "A", "C", "C", None],
#         index=span_ids,
#     )
#     assert_series_equal(
#         _cumulative(span_values, span_parent_ids),
#         pd.Series(
#             [4, 1, 2, 1, 1, 0],
#             dtype=span_values.dtype,
#             index=span_values.index,
#         ),
#     )
