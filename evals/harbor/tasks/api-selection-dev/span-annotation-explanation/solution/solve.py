#!/usr/bin/env python3
"""Explanation of a span annotation"""

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
    "/projects/openinference-tanstack-ai-verify-20260521/span_annotations",
    span_ids="c131b0bee8049eb2",
    include_annotation_names="quality",
    limit=100,
)
(a,) = annotations
write_answer(
    f"label {a['result']['label']}, score {a['result']['score']}: {a['result']['explanation']}"
)
