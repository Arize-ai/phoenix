from datetime import datetime
from uuid import uuid4

import pandas as pd
from phoenix.core.traces import END_TIME, PARENT_ID, SPAN_ID, START_TIME, Traces


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
