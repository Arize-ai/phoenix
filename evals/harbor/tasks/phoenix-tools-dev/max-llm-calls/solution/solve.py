#!/usr/bin/env python3
"""Largest number of LLM spans in any single trace."""

import sys

sys.path.insert(0, "/opt/verifier")

from evals.harbor.lib.phoenix_query import project_spans, spans_by_trace, write_answer

traces = spans_by_trace(project_spans("research-assistant"))
write_answer(
    str(max(sum(span["spanKind"] == "llm" for span in spans) for spans in traces.values()))
)
