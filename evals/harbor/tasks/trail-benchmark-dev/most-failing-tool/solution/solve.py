#!/usr/bin/env python3
"""The tool with the most ERROR spans."""

import sys

sys.path.insert(0, "/opt/verifier")

from collections import Counter

from evals.harbor.verifiers.phoenix_api import project_spans, write_answer

failures = Counter(
    span["name"]
    for span in project_spans("research-assistant")
    if span["span_kind"].upper() == "TOOL" and span["status_code"] == "ERROR"
)
top = max(failures.values())
write_answer(", ".join(sorted(name for name, count in failures.items() if count == top)))
