import json
from datetime import datetime
from typing import List, Optional

import pandas as pd

from phoenix.core.traces import Traces
from phoenix.trace.dsl import SpanFilter, SpanQuery
from phoenix.trace.span_json_encoder import span_to_json


def query_spans(
    traces: Traces,
    *queries: SpanQuery,
    start_time: Optional[datetime] = None,
    stop_time: Optional[datetime] = None,
    root_spans_only: Optional[bool] = None,
) -> List[pd.DataFrame]:
    if not queries or not traces:
        return []
    spans = tuple(
        traces.get_spans(
            start_time=start_time,
            stop_time=stop_time,
            root_spans_only=root_spans_only,
        )
    )
    return [query(spans) for query in queries]


def get_spans_dataframe(
    traces: Traces,
    span_filter: Optional[SpanFilter] = None,
    start_time: Optional[datetime] = None,
    stop_time: Optional[datetime] = None,
    root_spans_only: Optional[bool] = None,
) -> Optional[pd.DataFrame]:
    spans = traces.get_spans(
        start_time=start_time,
        stop_time=stop_time,
        root_spans_only=root_spans_only,
    )
    if span_filter:
        spans = filter(span_filter, spans)
    if not (data := [json.loads(span_to_json(span)) for span in spans]):
        return None
    return pd.json_normalize(data, max_level=1).set_index("context.span_id", drop=False)
