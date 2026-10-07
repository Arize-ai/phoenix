#!/usr/bin/env python3
"""Playground experiments that tripped on a template error"""

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
    "query($id: ID!) { node(id: $id) { ... on Dataset { experimentJobs(first: 100) { edges { node { status experiment { id name } lastError { message } } } } } } }",
    {"id": dataset_id("banking_saas_dataset")},
)["node"]
failed = [e["node"] for e in dataset["experimentJobs"]["edges"] if e["node"]["status"] == "ERROR"]
write_answer(
    "; ".join(
        f"{j['experiment']['id']} ({j['experiment']['name']}): {j['lastError']['message'] if j['lastError'] else 'no error'}"
        for j in sorted(failed, key=lambda j: rowid(j["experiment"]["id"]))
    )
)
