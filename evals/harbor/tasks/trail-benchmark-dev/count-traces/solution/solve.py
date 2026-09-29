#!/usr/bin/env python3
"""The seeded project's trace count."""

import sys

sys.path.insert(0, "/opt/verifier")

from evals.harbor.verifiers.phoenix_api import project_spans, spans_by_trace, write_answer

write_answer(str(len(spans_by_trace(project_spans("research-assistant")))))
