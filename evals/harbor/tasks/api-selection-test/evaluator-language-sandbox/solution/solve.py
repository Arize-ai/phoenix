#!/usr/bin/env python3
"""Language, sandbox, and version count of a code evaluator"""

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
        "{ evaluators(first: 100) { edges { node { name ... on CodeEvaluator {"
        " language versionCount sandboxConfig { name provider { backendType } } } } } } }"
    )["evaluators"]["edges"]
    if e["node"]["name"] == "safe_sql_exact_match"
]
sandbox = evaluator["sandboxConfig"]
write_answer(
    f"{evaluator['language']} in the {sandbox['name']} sandbox ({sandbox['provider']['backendType']}), "
    f"{evaluator['versionCount']} versions"
)
