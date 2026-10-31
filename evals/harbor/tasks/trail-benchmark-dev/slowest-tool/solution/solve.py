#!/usr/bin/env python3
"""The tool with the longest mean span duration."""

from collections import defaultdict
from datetime import datetime
from statistics import mean

from harbor_verifiers.phoenix_api import project_spans, write_answer

durations: dict[str, list[float]] = defaultdict(list)
for span in project_spans("research-assistant"):
    if span["span_kind"].upper() == "TOOL":
        elapsed = datetime.fromisoformat(span["end_time"]) - datetime.fromisoformat(
            span["start_time"]
        )
        durations[span["name"]].append(elapsed.total_seconds())
name = max(durations, key=lambda tool: mean(durations[tool]))
write_answer(f"{name}: {mean(durations[name]):.1f} seconds per call")
