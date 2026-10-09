#!/usr/bin/env python3
"""Split membership of an example"""

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

dataset = graphql(
    "query($id: ID!) { node(id: $id) { ... on Dataset { examples(first: 100) { edges { node { id datasetSplits { name } revision { input } } } } } } }",
    {"id": get_dataset_id_from_name("banking_saas_dataset_clean")},
)["node"]
(example,) = [
    e["node"]
    for e in dataset["examples"]["edges"]
    if "John Smith" in json.dumps(e["node"]["revision"]["input"])
]
write_answer(", ".join(s["name"] for s in example["datasetSplits"]) + f" (example {example['id']})")
