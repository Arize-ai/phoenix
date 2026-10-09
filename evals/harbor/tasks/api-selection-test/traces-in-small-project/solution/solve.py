#!/usr/bin/env python3
"""Traces of a small project with their first messages"""

import json  # noqa: F401
from collections import Counter  # noqa: F401

from harbor_verifiers.phoenix_api import (  # noqa: F401
    format_utc_timestamp,
    get_dataset_id_from_name,
    get_experiment_by_name,
    get_experiment_runs,
    get_generative_models,
    get_nested_attribute,
    graphql,
    rest,
    rest_pages,
    rowid,
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
