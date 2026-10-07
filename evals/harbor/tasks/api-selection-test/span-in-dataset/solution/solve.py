#!/usr/bin/env python3
"""Dataset membership of a span"""

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

span = graphql(
    "query($s: String!) { getSpanByOtelId(spanId: $s) { containedInDataset } }",
    {"s": "1b91cd85d269b2b3"},
)["getSpanByOtelId"]
datasets = graphql(
    "{ datasets(first: 50) { edges { node { name"
    " examples(first: 100) { edges { node { id span { spanId } } } } } } } }"
)["datasets"]["edges"]
hits = [
    (d["node"]["name"], e["node"]["id"])
    for d in datasets
    for e in d["node"]["examples"]["edges"]
    if e["node"]["span"] and e["node"]["span"]["spanId"] == "1b91cd85d269b2b3"
]
write_answer(
    ("yes: " if span["containedInDataset"] else "no: ")
    + "; ".join(f"dataset {name} (example {example})" for name, example in hits)
)
