#!/usr/bin/env python3
"""Source span of a dataset example"""

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
    "query($id: ID!) { node(id: $id) { ... on Dataset { examples(first: 100) { edges { node { id span { spanId name trace { traceId } } revision { output } } } } } } }",
    {"id": get_dataset_id_from_name("High Token Count Spans (>20k)")},
)["node"]
example = min((e["node"] for e in dataset["examples"]["edges"]), key=lambda e: rowid(e["id"]))
span = example["span"]
write_answer(
    f"span {span['spanId']} ({span['name']}, trace {span['trace']['traceId']}); "
    f"{example['revision']['output'].get('token_count_total')} total tokens (example {example['id']})"
)
