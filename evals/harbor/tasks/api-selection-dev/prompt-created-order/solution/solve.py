#!/usr/bin/env python3
"""Most recently created prompt"""

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

prompts = [
    e["node"]
    for e in graphql("{ prompts(first: 100) { edges { node { name createdAt } } } }")["prompts"][
        "edges"
    ]
]
latest = max(prompts, key=lambda p: p["createdAt"])
write_answer(f"{latest['name']}, {format_utc_timestamp(latest['createdAt'])}")
