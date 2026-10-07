#!/usr/bin/env python3
"""Split membership of an example"""

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

dataset = graphql(
    "query($id: ID!) { node(id: $id) { ... on Dataset { examples(first: 100) { edges { node { id datasetSplits { name } revision { input } } } } } } }",
    {"id": dataset_id("banking_saas_dataset_clean")},
)["node"]
(example,) = [
    e["node"]
    for e in dataset["examples"]["edges"]
    if "John Smith" in json.dumps(e["node"]["revision"]["input"])
]
write_answer(", ".join(s["name"] for s in example["datasetSplits"]) + f" (example {example['id']})")
