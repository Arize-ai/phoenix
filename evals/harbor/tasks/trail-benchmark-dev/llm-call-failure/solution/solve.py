#!/usr/bin/env python3
"""The status message of the failing LLM span."""

import sys

sys.path.insert(0, "/opt/verifier")

from evals.harbor.verifiers.phoenix_api import project_spans, write_answer

failures = [
    span
    for span in project_spans("research-assistant")
    if span["span_kind"].upper() == "LLM" and span["status_code"] == "ERROR"
]
write_answer(
    f"{len(failures)} failing LLM span(s): "
    + " | ".join(span["status_message"] for span in failures)
)
