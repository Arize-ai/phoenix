#!/usr/bin/env python3
"""Session score outside its config bounds"""

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

config = rest("/annotation_configs/response_quality")["data"]
low, high = config["lower_bound"], config["upper_bound"]
sessions = [
    s["session_id"] for s in rest_pages("/projects/mobile-review-queue/sessions", limit=100)
]
annotations = rest_pages(
    "/projects/mobile-review-queue/session_annotations",
    session_ids=sessions,
    include_annotation_names="response_quality",
    limit=1000,
)
outside = sorted(
    (a["session_id"], a["result"]["score"])
    for a in annotations
    if a["result"]["score"] is not None and not low <= a["result"]["score"] <= high
)
write_answer(
    f"bounds {low:g} to {high:g}; outside: "
    + ", ".join(f"{session} ({score:g})" for session, score in outside)
)
