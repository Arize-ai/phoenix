#!/usr/bin/env python3
"""Explanation of a span annotation"""

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
    "/projects/openinference-tanstack-ai-verify-20260521/span_annotations",
    span_ids="c131b0bee8049eb2",
    include_annotation_names="quality",
    limit=100,
)
(a,) = annotations
write_answer(
    f"label {a['result']['label']}, score {a['result']['score']}: {a['result']['explanation']}"
)
