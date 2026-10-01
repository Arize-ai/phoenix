#!/usr/bin/env python3
"""The mean trail_reliability trace annotation score."""

import sys

sys.path.insert(0, "/opt/verifier")

from statistics import mean

from evals.harbor.verifiers.phoenix_api import (
    project_spans,
    spans_by_trace,
    trace_annotation_scores,
    write_answer,
)

trace_ids = sorted(spans_by_trace(project_spans("research-assistant")))
scores = trace_annotation_scores("research-assistant", "trail_reliability", trace_ids)
write_answer(f"{mean(scores.values()):.2f} across {len(scores)} traces")
