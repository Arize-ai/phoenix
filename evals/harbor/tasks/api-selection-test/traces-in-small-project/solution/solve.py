#!/usr/bin/env python3
"""Traces of a small project with their first messages"""

import json  # noqa: F401
from collections import Counter  # noqa: F401

from harbor_verifiers.phoenix_api import (  # noqa: F401
    attribute,
    dataset_id,
    experiment_by_name,
    experiment_runs,
    generative_models,
    graphql,
    rest,
    rest_pages,
    rowid,
    utc,
    write_answer,
)

traces = rest_pages("/projects/assistant_agent/traces", sort="start_time", order="asc", limit=1000)
parts = []
for trace in traces:
    root = graphql(
        "query($t: String!) { getTraceByOtelId(traceId: $t) { rootSpan { input { value } } } }",
        {"t": trace["trace_id"]},
    )
    parts.append(
        f"{trace['trace_id']} ({root['getTraceByOtelId']['rootSpan']['input']['value'][:80]!r})"
    )
write_answer(f"{len(traces)} traces: " + "; ".join(parts))
