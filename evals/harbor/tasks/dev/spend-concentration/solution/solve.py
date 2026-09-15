#!/usr/bin/env python3
"""Share of total cost from the top 10% of traces by cost, rounded up."""

import sys

sys.path.insert(0, "/opt/verifier")

import math

from evals.harbor.lib.phoenix_query import project_spans, span_cost, spans_by_trace, write_answer

costs = {
    trace_id: sum(span_cost(span) for span in spans)
    for trace_id, spans in spans_by_trace(project_spans("research-assistant")).items()
}
top = sorted(costs, key=lambda trace_id: (-costs[trace_id], trace_id))[: math.ceil(len(costs) / 10)]
write_answer(f"{100 * sum(costs[trace_id] for trace_id in top) / sum(costs.values()):.1f}%")
