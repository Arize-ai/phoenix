#!/usr/bin/env python3
"""The most LLM spans in any one trace."""

from harbor_verifiers.phoenix_api import project_spans, spans_by_trace, write_answer

traces = spans_by_trace(project_spans("research-assistant"))
write_answer(
    str(max(sum(span["span_kind"].upper() == "LLM" for span in spans) for spans in traces.values()))
)
