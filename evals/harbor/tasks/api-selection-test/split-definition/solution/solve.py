#!/usr/bin/env python3
"""Definition and total size of a split"""

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

(split,) = [
    e["node"]
    for e in graphql("{ datasetSplits { edges { node { name color description } } } }")[
        "datasetSplits"
    ]["edges"]
    if e["node"]["name"] == "refusal"
]
per_dataset = {}
for dataset in rest_pages("/datasets", limit=100):
    for s in rest_pages(f"/datasets/{dataset['id']}/splits", limit=100):
        if s["name"] == "refusal":
            per_dataset[dataset["name"]] = s["example_count"]
write_answer(
    f"colour {split['color']}, description {split['description'] or 'none'}, "
    f"{sum(per_dataset.values())} examples across {len(per_dataset)} datasets "
    f"({', '.join(f'{k} {v}' for k, v in sorted(per_dataset.items()))})"
)
