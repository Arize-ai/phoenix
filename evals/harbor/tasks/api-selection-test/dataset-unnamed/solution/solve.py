#!/usr/bin/env python3
"""Datasets with auto-generated names"""

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

datasets = [d for d in rest_pages("/datasets", limit=100) if d["name"].startswith("Dataset 20")]
write_answer(
    "; ".join(
        f"{d['name']} ({d['example_count']} example)"
        for d in sorted(datasets, key=lambda d: d["name"])
    )
)
