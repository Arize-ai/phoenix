#!/usr/bin/env python3
"""Sessions of a project in chronological order"""

import json  # noqa: F401
from collections import Counter  # noqa: F401

from harbor_verifiers.phoenix_api import (  # noqa: F401
    attribute,
    dataset_id,
    experiment_by_name,
    experiment_runs,
    generative_models,
    graphql,
    rest,
    rest_pages,
    rowid,
    utc,
    write_answer,
)

sessions = rest_pages("/projects/mobile-review-queue/sessions", order="asc", limit=100)
write_answer(", ".join(s["session_id"] for s in sorted(sessions, key=lambda s: s["start_time"])))
