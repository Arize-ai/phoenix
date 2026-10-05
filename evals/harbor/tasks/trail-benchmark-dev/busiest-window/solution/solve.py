#!/usr/bin/env python3
"""The clock-aligned 10-minute window in which the most traces started."""

from collections import Counter
from datetime import UTC, datetime, timedelta

from harbor_verifiers.phoenix_api import project_spans, spans_by_trace, write_answer

windows: Counter[datetime] = Counter()
for spans in spans_by_trace(project_spans("research-assistant")).values():
    start = min(datetime.fromisoformat(span["start_time"]) for span in spans).astimezone(UTC)
    windows[start.replace(minute=start.minute - start.minute % 10, second=0, microsecond=0)] += 1
window, count = windows.most_common(1)[0]
end = window + timedelta(minutes=10)
write_answer(f"{window:%Y-%m-%d %H:%M}-{end:%H:%M} UTC: {count} traces")
