#!/usr/bin/env python3
"""Language, sandbox, and version count of a code evaluator"""

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
