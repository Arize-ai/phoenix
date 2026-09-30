#!/usr/bin/env python3
"""Total cost of the seeded project, as Phoenix computes it."""

import sys

sys.path.insert(0, "/opt/verifier")

from evals.harbor.verifiers.phoenix_api import span_costs

print(f"${sum(span_costs('research-assistant').values()):.2f}")
