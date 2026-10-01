#!/usr/bin/env python3
"""The task question of the most expensive trace."""

import sys

sys.path.insert(0, "/opt/verifier")

import json

from evals.harbor.verifiers.phoenix_api import (
    project_spans,
    span_costs,
    spans_by_trace,
    write_answer,
)

cost_of = span_costs("research-assistant")
traces = spans_by_trace(project_spans("research-assistant"))
costs = {
    trace_id: sum(cost_of.get(span["context"]["span_id"], 0.0) for span in spans)
    for trace_id, spans in traces.items()
}
trace_id = max(costs, key=lambda trace: costs[trace])
agent = next(span for span in traces[trace_id] if span["name"] == "CodeAgent.run")
task = json.loads(agent["attributes"]["input.value"])["task"]
question = task.split("Here is the task:", 1)[1].strip().split("\n\n", 1)[0]
write_answer(f"${costs[trace_id]:.3f}: {question}")
