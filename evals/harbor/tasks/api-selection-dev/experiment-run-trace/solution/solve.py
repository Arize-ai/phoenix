#!/usr/bin/env python3
"""Trace produced by one experiment run"""

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

experiment = get_experiment_by_name(
    "banking_saas_dataset_clean", "safe-sql prompt v4 disambiguation"
)
(run,) = [
    r
    for r in get_experiment_runs(experiment["id"])
    if "Did I receive my paycheck this week?" in json.dumps(r.example.revision.input)
]
write_answer(f"trace {run.trace_id} in project {experiment['project_name']}")
