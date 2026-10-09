#!/usr/bin/env python3
"""Sessions of a project in chronological order"""

import json  # noqa: F401
from collections import Counter  # noqa: F401

from harbor_verifiers.phoenix_api import (  # noqa: F401
    format_utc_timestamp,
    get_dataset_id_from_name,
    get_experiment_by_name,
    get_experiment_runs,
    get_generative_models,
    get_nested_attribute,
    graphql,
    rest,
    rest_pages,
    rowid,
    write_answer,
)

sessions = rest_pages("/projects/mobile-review-queue/sessions", order="asc", limit=100)
write_answer(", ".join(s["session_id"] for s in sorted(sessions, key=lambda s: s["start_time"])))
