#!/usr/bin/env python3
"""Dataset split an experiment ran on"""

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

experiment = graphql(
    "query($id: ID!) { node(id: $id) { ... on Experiment { datasetSplits { edges { node { name } } } } } }",
    {"id": "RXhwZXJpbWVudDo5Mw=="},
)
write_answer(
    ", ".join(e["node"]["name"] for e in experiment["node"]["datasetSplits"]["edges"]) or "none"
)
