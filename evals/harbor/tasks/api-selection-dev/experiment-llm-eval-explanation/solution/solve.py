#!/usr/bin/env python3
"""LLM judge explanation on one experiment run"""

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

(run,) = [
    r
    for r in get_experiment_runs("RXhwZXJpbWVudDoxMDE=")
    if r.example.revision.metadata.get("case") == "url_without_access"
]
write_answer(
    "; ".join(
        f"{a.node.name} {a.node.label} ({a.node.score:g}): {a.node.explanation}"
        for a in run.annotations.edges
    )
)
