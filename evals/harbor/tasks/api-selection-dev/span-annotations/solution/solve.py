#!/usr/bin/env python3
"""Annotations on a span"""

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
    "/projects/pxi_dev/span_annotations", span_ids="6a41eb4766c2bb30", limit=100
)
parts = []
for a in sorted(annotations, key=lambda a: a["name"]):
    score = a["result"]["score"]
    parts.append(f"{a['name']} = {a['result']['label']} ({'no score' if score is None else score})")
write_answer("; ".join(parts))
