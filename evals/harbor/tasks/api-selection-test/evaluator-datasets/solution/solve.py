#!/usr/bin/env python3
"""Datasets using an evaluator"""

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

(evaluator,) = [
    e["node"]
    for e in graphql(
        "{ evaluators(first: 100) { edges { node { name datasets(first: 50) { edges { node { name } } } } } } }"
    )["evaluators"]["edges"]
    if e["node"]["name"] == "first_tool_matches_expected"
]
names = [e["node"]["name"] for e in evaluator["datasets"]["edges"]]
write_answer(", ".join(names) + (" only" if len(names) == 1 else ""))
