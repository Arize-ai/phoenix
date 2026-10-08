#!/usr/bin/env python3
"""Job status and last error of an experiment"""

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

job = graphql(
    "query($id: ID!) { node(id: $id) { ... on Experiment { job { status lastError { message } errors(first: 50) { edges { node { category message } } } } } } }",
    {"id": "RXhwZXJpbWVudDoxMzM="},
)["node"]["job"]
counts = Counter(f"{e['node']['category']} {e['node']['message']}" for e in job["errors"]["edges"])
write_answer(
    f"{job['status']}; last error {job['lastError']['message']!r}; "
    + ", ".join(f"{n} x {m}" for m, n in counts.most_common())
)
