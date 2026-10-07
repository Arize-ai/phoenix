#!/usr/bin/env python3
"""Evaluator counts by kind"""

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
