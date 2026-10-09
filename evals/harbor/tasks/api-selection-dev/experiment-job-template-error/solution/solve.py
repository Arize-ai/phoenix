#!/usr/bin/env python3
"""Playground experiments that tripped on a template error"""

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
    "query($id: ID!) { node(id: $id) { ... on Dataset { experimentJobs(first: 100) { edges { node { status experiment { id name } lastError { message } } } } } } }",
    {"id": get_dataset_id_from_name("banking_saas_dataset")},
)["node"]
failed = [e["node"] for e in dataset["experimentJobs"]["edges"] if e["node"]["status"] == "ERROR"]
write_answer(
    "; ".join(
        f"{j['experiment']['id']} ({j['experiment']['name']}): {j['lastError']['message'] if j['lastError'] else 'no error'}"
        for j in sorted(failed, key=lambda j: rowid(j["experiment"]["id"]))
    )
)
