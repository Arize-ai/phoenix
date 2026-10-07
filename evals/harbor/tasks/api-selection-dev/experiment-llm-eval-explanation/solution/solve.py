#!/usr/bin/env python3
"""LLM judge explanation on one experiment run"""

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

(run,) = [
    r
    for r in experiment_runs("RXhwZXJpbWVudDoxMDE=")
    if r["example"]["revision"]["metadata"].get("case") == "url_without_access"
]
write_answer(
    "; ".join(
        f"{a['name']} {a['label']} ({a['score']:g}): {a['explanation']}" for a in run["annotations"]
    )
)
