from datetime import datetime
from uuid import uuid4

import pandas as pd
from pandas.testing import assert_series_equal
from phoenix.core.traces import (
    END_TIME,
    PARENT_ID,
    SPAN_ID,
    START_TIME,
    Traces,
    _cumulative,
)


def test_get_descendant_span_ids() -> None:
    ids = [uuid4() for _ in range(6)]
    traces = Traces(
        pd.DataFrame(
            {
                START_TIME: datetime.now(),
                END_TIME: datetime.now(),
                SPAN_ID: ids,
                PARENT_ID: [None, None, ids[1], ids[1], ids[2], ids[4]],
            }
        ).sample(frac=1)
    )
    assert set(traces.get_descendant_span_ids(ids[0])) == set()
    assert set(traces.get_descendant_span_ids(ids[1])) == set(ids[2:])
    assert set(traces.get_descendant_span_ids(ids[2])) == set(ids[4:])
    assert set(traces.get_descendant_span_ids(ids[3])) == set()
    assert set(traces.get_descendant_span_ids(ids[4])) == set(ids[5:])
    assert set(traces.get_descendant_span_ids(ids[5])) == set()


def test_cumulative() -> None:
    span_ids = list("ABCDEF")
    span_values = pd.Series(
        [1, 1, None, 1, 1, None],
        index=span_ids,
    )
    span_parent_ids = pd.Series(
        [None, "A", "A", "C", "C", None],
        index=span_ids,
    )
    assert_series_equal(
        _cumulative(span_values, span_parent_ids),
        pd.Series(
            [4, 1, 2, 1, 1, 0],
            dtype=span_values.dtype,
            index=span_values.index,
        ),
    )
