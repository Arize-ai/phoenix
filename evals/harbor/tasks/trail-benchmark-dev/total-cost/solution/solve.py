#!/usr/bin/env python3
"""Total cost of the seeded project, as Phoenix computes it."""

from harbor_verifiers.phoenix_api import span_costs, write_answer

write_answer(f"${sum(span_costs('research-assistant').values()):.2f}")
