#!/usr/bin/env python3
"""The most LLM spans in any one trace."""

import sys

sys.path.insert(0, "/opt/verifier")

from evals.harbor.verifiers.phoenix_api import project_spans, spans_by_trace, write_answer

traces = spans_by_trace(project_spans("research-assistant"))
write_answer(
    str(max(sum(span["span_kind"].upper() == "LLM" for span in spans) for spans in traces.values()))
)
