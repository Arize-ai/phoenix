#!/usr/bin/env python3
"""Project collecting a dataset evaluator's traces"""

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
    "query($id: ID!) { node(id: $id) { ... on Dataset { datasetEvaluators(first: 50) { edges { node { name project { name traceCount } } } } } } }",
    {"id": get_dataset_id_from_name("banking_saas_dataset_clean")},
)["node"]
(evaluator,) = [
    e["node"]
    for e in dataset["datasetEvaluators"]["edges"]
    if e["node"]["name"] == "safe_sql_exact_match"
]
write_answer(f"{evaluator['project']['name']} with {evaluator['project']['traceCount']} traces")
