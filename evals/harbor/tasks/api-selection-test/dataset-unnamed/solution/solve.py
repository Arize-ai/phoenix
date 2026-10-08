#!/usr/bin/env python3
"""Datasets with auto-generated names"""

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

datasets = [d for d in rest_pages("/datasets", limit=100) if d["name"].startswith("Dataset 20")]
write_answer(
    "; ".join(
        f"{d['name']} ({d['example_count']} example)"
        for d in sorted(datasets, key=lambda d: d["name"])
    )
)
