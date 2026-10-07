#!/usr/bin/env python3
"""Dataset split an experiment ran on"""

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

experiment = graphql(
    "query($id: ID!) { node(id: $id) { ... on Experiment { datasetSplits { edges { node { name } } } } } }",
    {"id": "RXhwZXJpbWVudDo5Mw=="},
)
write_answer(
    ", ".join(e["node"]["name"] for e in experiment["node"]["datasetSplits"]["edges"]) or "none"
)
