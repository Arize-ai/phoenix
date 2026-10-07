#!/usr/bin/env python3
"""Prompts that carry metadata"""

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

prompts = [p for p in rest_pages("/prompts", limit=100) if p["metadata"]]
write_answer(
    "; ".join(
        f"{p['name']}: {json.dumps(p['metadata'])}"
        for p in sorted(prompts, key=lambda p: p["name"])
    )
)
