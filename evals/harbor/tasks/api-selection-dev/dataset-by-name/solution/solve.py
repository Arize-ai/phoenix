#!/usr/bin/env python3
"""Description and id of a dataset"""

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

(dataset,) = [
    d
    for d in rest("/datasets", name="github-support-triage-tool-routing")["data"]
    if d["name"] == "github-support-triage-tool-routing"
]
write_answer(f"{dataset['description']!r}; id {dataset['id']}")
