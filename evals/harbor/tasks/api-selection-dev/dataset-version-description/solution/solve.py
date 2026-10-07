#!/usr/bin/env python3
"""What the second version of a dataset changed"""

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

versions = sorted(
    rest_pages(f"/datasets/{dataset_id('High Token Count Spans (>20k)')}/versions", limit=100),
    key=lambda v: v["created_at"],
)
write_answer(
    f"second version: {versions[1]['description']!r} (first: {versions[0]['description']!r})"
)
