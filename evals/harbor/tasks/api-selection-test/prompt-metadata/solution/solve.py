#!/usr/bin/env python3
"""Prompts that carry metadata"""

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

prompts = [p for p in rest_pages("/prompts", limit=100) if p["metadata"]]
write_answer(
    "; ".join(
        f"{p['name']}: {json.dumps(p['metadata'])}"
        for p in sorted(prompts, key=lambda p: p["name"])
    )
)
