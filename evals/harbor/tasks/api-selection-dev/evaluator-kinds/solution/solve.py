#!/usr/bin/env python3
"""Evaluator counts by kind"""

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

custom = [
    e["node"]
    for e in graphql("{ evaluators(first: 100) { edges { node { kind name } } } }")["evaluators"][
        "edges"
    ]
]
builtin = graphql("{ builtInEvaluators { name } }")["builtInEvaluators"]
counts = Counter(e["kind"] for e in custom)
write_answer(
    f"{len(custom) + len(builtin)} in total: {len(builtin)} built-in, "
    + ", ".join(f"{n} {kind}" for kind, n in sorted(counts.items()))
)
