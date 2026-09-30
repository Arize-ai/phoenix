#!/usr/bin/env python3
"""Span error rates of short and long traces."""

import sys

sys.path.insert(0, "/opt/verifier")

from evals.harbor.verifiers.phoenix_api import project_spans, spans_by_trace, write_answer

traces = spans_by_trace(project_spans("research-assistant"))
groups = {
    "Short": [span for spans in traces.values() if len(spans) < 15 for span in spans],
    "Long": [span for spans in traces.values() if len(spans) >= 40 for span in spans],
}
write_answer(
    "; ".join(
        f"{label}: {100 * sum(span['status_code'] == 'ERROR' for span in spans) / len(spans):.1f}%"
        for label, spans in groups.items()
    )
)
