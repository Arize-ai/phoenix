#!/usr/bin/env python3
"""Dataset evaluators attached to an experiment"""

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

job = graphql(
    "query($id: ID!) { node(id: $id) { ... on Experiment { job { datasetEvaluators(first: 50) { edges { node { name } } } } } } }",
    {"id": "RXhwZXJpbWVudDoxMDE="},
)["node"]["job"]
names = [e["node"]["name"] for e in job["datasetEvaluators"]["edges"]]
write_answer(", ".join(names) + (" only" if len(names) == 1 else ""))
