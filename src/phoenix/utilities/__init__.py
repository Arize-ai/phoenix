from datetime import datetime
from typing import List, Optional

import pandas as pd

from phoenix.core.project import Project
from phoenix.trace.dsl import SpanQuery


def query_spans(
    project: Optional[Project],
    *queries: SpanQuery,
    start_time: Optional[datetime] = None,
    stop_time: Optional[datetime] = None,
    root_spans_only: Optional[bool] = None,
) -> List[pd.DataFrame]:
    if not queries or not project:
        return []
    spans = tuple(
        project.get_spans(
            start_time=start_time,
            stop_time=stop_time,
            root_spans_only=root_spans_only,
        )
    )
    return [query(spans) for query in queries]
