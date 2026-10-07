#!/usr/bin/env python3
"""Split sizes of a dataset"""

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

splits = rest_pages(f"/datasets/{dataset_id('banking_saas_dataset_clean')}/splits", limit=100)
write_answer(
    ", ".join(f"{s['name']} {s['example_count']}" for s in sorted(splits, key=lambda s: s["name"]))
)
