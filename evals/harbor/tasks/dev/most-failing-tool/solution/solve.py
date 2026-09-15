#!/usr/bin/env python3
"""Tool span name with the most ERROR spans."""

import sys

sys.path.insert(0, "/opt/verifier")

from collections import Counter

from evals.harbor.lib.phoenix_query import project_spans, write_answer

failures = Counter(
    span["name"]
    for span in project_spans("research-assistant")
    if span["spanKind"] == "tool" and span["statusCode"] == "ERROR"
)
top = max(failures.values())
write_answer(", ".join(sorted(name for name, count in failures.items() if count == top)))
