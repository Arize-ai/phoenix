#!/usr/bin/env python3
"""Evaluators attached to a dataset"""

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

dataset = graphql(
    "query($id: ID!) { node(id: $id) { ... on Dataset { datasetEvaluators(first: 50) { edges { node { name } } } } } }",
    {"id": dataset_id("banking_saas_dataset")},
)["node"]
write_answer(", ".join(sorted(e["node"]["name"] for e in dataset["datasetEvaluators"]["edges"])))
