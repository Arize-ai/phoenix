from uuid import uuid4

import pandas as pd
from phoenix.core.traces import Traces


def test_get_descendant_span_ids() -> None:
    ids = [uuid4() for _ in range(6)]
    traces = Traces(
        pd.DataFrame(
            {
                "context.span_id": ids,
                "parent_id": [None, None, ids[1], ids[1], ids[2], ids[4]],
            }
        ).sample(frac=1)
    )
    assert set(traces.get_descendant_span_ids(ids[0])) == set()
    assert set(traces.get_descendant_span_ids(ids[1])) == set(ids[2:])
    assert set(traces.get_descendant_span_ids(ids[2])) == set(ids[4:])
    assert set(traces.get_descendant_span_ids(ids[3])) == set()
    assert set(traces.get_descendant_span_ids(ids[4])) == set(ids[5:])
    assert set(traces.get_descendant_span_ids(ids[5])) == set()
