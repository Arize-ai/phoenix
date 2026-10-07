#!/usr/bin/env python3
"""Dataset evaluators attached to an experiment"""

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

job = graphql(
    "query($id: ID!) { node(id: $id) { ... on Experiment { job { datasetEvaluators(first: 50) { edges { node { name } } } } } } }",
    {"id": "RXhwZXJpbWVudDoxMDE="},
)["node"]["job"]
names = [e["node"]["name"] for e in job["datasetEvaluators"]["edges"]]
write_answer(", ".join(names) + (" only" if len(names) == 1 else ""))
