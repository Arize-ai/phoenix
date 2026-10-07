#!/usr/bin/env python3
"""Annotations on a session"""

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
