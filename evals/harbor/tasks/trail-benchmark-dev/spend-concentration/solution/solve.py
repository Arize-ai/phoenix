#!/usr/bin/env python3
"""Share of total cost in the most expensive tenth of traces."""

import sys

sys.path.insert(0, "/opt/verifier")

import math

from evals.harbor.verifiers.phoenix_api import (
    project_spans,
    span_costs,
    spans_by_trace,
    write_answer,
)

cost_of = span_costs("research-assistant")
costs = {
    trace_id: sum(cost_of.get(span["context"]["span_id"], 0.0) for span in spans)
    for trace_id, spans in spans_by_trace(project_spans("research-assistant")).items()
}
top = sorted(costs, key=lambda trace_id: (-costs[trace_id], trace_id))[: math.ceil(len(costs) / 10)]
write_answer(f"{100 * sum(costs[trace_id] for trace_id in top) / sum(costs.values()):.1f}%")
