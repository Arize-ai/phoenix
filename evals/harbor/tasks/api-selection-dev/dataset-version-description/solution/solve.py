#!/usr/bin/env python3
"""What the second version of a dataset changed"""

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

versions = sorted(
    rest_pages(
        f"/datasets/{get_dataset_id_from_name('High Token Count Spans (>20k)')}/versions", limit=100
    ),
    key=lambda v: v["created_at"],
)
write_answer(
    f"second version: {versions[1]['description']!r} (first: {versions[0]['description']!r})"
)
