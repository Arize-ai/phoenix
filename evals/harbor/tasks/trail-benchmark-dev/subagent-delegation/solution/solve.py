#!/usr/bin/env python3
"""Traces containing a ToolCallingAgent.run span."""

import sys

sys.path.insert(0, "/opt/verifier")

from evals.harbor.verifiers.phoenix_api import project_spans, write_answer

traces = {
    span["context"]["trace_id"]
    for span in project_spans("research-assistant")
    if span["name"] == "ToolCallingAgent.run"
}
write_answer(f"{len(traces)} traces")
