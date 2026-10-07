#!/usr/bin/env python3
"""Creator of a dataset"""

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

datasets = [
    e["node"]
    for e in graphql("{ datasets(first: 100) { edges { node { name createdBy { username } } } } }")[
        "datasets"
    ]["edges"]
]
attributed = {d["name"]: d["createdBy"]["username"] for d in datasets if d["createdBy"]}
others = {k: v for k, v in attributed.items() if k != "banking_saas_dataset"}
write_answer(
    f"banking_saas_dataset was created by {attributed.get('banking_saas_dataset')}; "
    + (
        f"other attributed datasets: {others}"
        if others
        else "no other dataset has a recorded creator"
    )
)
