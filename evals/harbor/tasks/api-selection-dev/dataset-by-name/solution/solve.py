#!/usr/bin/env python3
"""Description and id of a dataset"""

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

(dataset,) = [
    d
    for d in rest("/datasets", name="github-support-triage-tool-routing")["data"]
    if d["name"] == "github-support-triage-tool-routing"
]
write_answer(f"{dataset['description']!r}; id {dataset['id']}")
