#!/usr/bin/env python3
"""Datasets using an evaluator"""

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

(evaluator,) = [
    e["node"]
    for e in graphql(
        "{ evaluators(first: 100) { edges { node { name datasets(first: 50) { edges { node { name } } } } } } }"
    )["evaluators"]["edges"]
    if e["node"]["name"] == "first_tool_matches_expected"
]
names = [e["node"]["name"] for e in evaluator["datasets"]["edges"]]
write_answer(", ".join(names) + (" only" if len(names) == 1 else ""))
