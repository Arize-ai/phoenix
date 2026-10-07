#!/usr/bin/env python3
"""Most recently created prompt"""

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

prompts = [
    e["node"]
    for e in graphql("{ prompts(first: 100) { edges { node { name createdAt } } } }")["prompts"][
        "edges"
    ]
]
latest = max(prompts, key=lambda p: p["createdAt"])
write_answer(f"{latest['name']}, {utc(latest['createdAt'])}")
