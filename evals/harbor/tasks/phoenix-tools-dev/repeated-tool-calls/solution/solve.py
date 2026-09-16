#!/usr/bin/env python3
"""Tool with the most calls inside one trace, and that count."""

import sys

sys.path.insert(0, "/opt/verifier")

from collections import Counter

from evals.harbor.lib.phoenix_query import project_spans, spans_by_trace, write_answer

repeats = Counter(
    (trace_id, span["name"])
    for trace_id, spans in spans_by_trace(project_spans("research-assistant")).items()
    for span in spans
    if span["spanKind"] == "tool"
)
(_, name), count = repeats.most_common(1)[0]
write_answer(f"{name}: {count} calls")
