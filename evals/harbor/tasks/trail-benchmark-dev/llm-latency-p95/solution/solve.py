#!/usr/bin/env python3
"""The 95th-percentile duration of LLM spans."""

import statistics
from datetime import datetime

from harbor_verifiers.phoenix_api import project_spans, write_answer

durations = [
    (
        datetime.fromisoformat(span["end_time"]) - datetime.fromisoformat(span["start_time"])
    ).total_seconds()
    for span in project_spans("research-assistant")
    if span["span_kind"].upper() == "LLM"
]
p95 = statistics.quantiles(durations, n=100, method="inclusive")[94]
write_answer(f"{p95:.1f} seconds")
