#!/usr/bin/env python3
"""Total cost of every span in the project."""

import sys

sys.path.insert(0, "/opt/verifier")

from evals.harbor.lib.phoenix_query import project_spans, span_cost, write_answer

write_answer(f"${sum(span_cost(span) for span in project_spans('research-assistant')):.2f}")
