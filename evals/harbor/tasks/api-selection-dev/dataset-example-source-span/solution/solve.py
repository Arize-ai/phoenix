#!/usr/bin/env python3
"""Source span of a dataset example"""

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
    "query($id: ID!) { node(id: $id) { ... on Dataset { examples(first: 100) { edges { node { id span { spanId name trace { traceId } } revision { output } } } } } } }",
    {"id": dataset_id("High Token Count Spans (>20k)")},
)["node"]
example = min((e["node"] for e in dataset["examples"]["edges"]), key=lambda e: rowid(e["id"]))
span = example["span"]
write_answer(
    f"span {span['spanId']} ({span['name']}, trace {span['trace']['traceId']}); "
    f"{example['revision']['output'].get('token_count_total')} total tokens (example {example['id']})"
)
