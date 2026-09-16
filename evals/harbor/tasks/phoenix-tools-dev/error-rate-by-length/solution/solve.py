#!/usr/bin/env python3
"""Error rate of spans in short (<15 spans) and long (>=40 spans) traces."""

import sys

sys.path.insert(0, "/opt/verifier")

from evals.harbor.lib.phoenix_query import project_spans, spans_by_trace, write_answer

traces = spans_by_trace(project_spans("research-assistant"))
groups = {
    "Short": [span for spans in traces.values() if len(spans) < 15 for span in spans],
    "Long": [span for spans in traces.values() if len(spans) >= 40 for span in spans],
}
write_answer(
    "; ".join(
        f"{label}: {100 * sum(span['statusCode'] == 'ERROR' for span in spans) / len(spans):.1f}%"
        for label, spans in groups.items()
    )
)
