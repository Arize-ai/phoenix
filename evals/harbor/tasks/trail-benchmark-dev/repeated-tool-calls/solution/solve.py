#!/usr/bin/env python3
"""The tool called most often within one trace."""

from collections import Counter

from harbor_verifiers.phoenix_api import project_spans, spans_by_trace, write_answer

repeats = Counter(
    (trace_id, span["name"])
    for trace_id, spans in spans_by_trace(project_spans("research-assistant")).items()
    for span in spans
    if span["span_kind"].upper() == "TOOL"
)
(_, name), count = repeats.most_common(1)[0]
write_answer(f"{name}: {count} calls")
