#!/usr/bin/env python3
"""Annotations on a session"""

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

annotations = rest_pages(
    "/projects/mobile-review-queue/session_annotations",
    session_ids="chaotic-eval-run-51",
    limit=100,
)
parts = []
for a in sorted(annotations, key=lambda a: (a["name"], a["created_at"])):
    label, score = a["result"]["label"], a["result"]["score"]
    parts.append(f"{a['name']} = {label or 'no label'} ({'no score' if score is None else score})")
write_answer("; ".join(parts))
