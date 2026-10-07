#!/usr/bin/env python3
"""Output labels of a code evaluator"""

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
        "{ evaluators(first: 100) { edges { node { name ... on CodeEvaluator { datasetEvaluators {"
        " dataset { name } outputConfigs { ... on CategoricalAnnotationConfig {"
        " optimizationDirection values { label score } } } } } } } } }"
    )["evaluators"]["edges"]
    if e["node"]["name"] == "no_sql_in_output"
]
# Output configs live on the per-dataset attachment, not on the code evaluator itself.
(attachment,) = evaluator["datasetEvaluators"]
(config,) = attachment["outputConfigs"]
values = ", ".join(f"{v['label']} = {v['score']:g}" for v in config["values"])
best = max(
    config["values"],
    key=lambda v: v["score"] if config["optimizationDirection"] == "MAXIMIZE" else -v["score"],
)
write_answer(f"{values}; direction {config['optimizationDirection']}, so {best['label']} is better")
