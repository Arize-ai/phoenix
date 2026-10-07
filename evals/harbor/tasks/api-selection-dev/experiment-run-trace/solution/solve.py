#!/usr/bin/env python3
"""Trace produced by one experiment run"""

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

experiment = experiment_by_name("banking_saas_dataset_clean", "safe-sql prompt v4 disambiguation")
(run,) = [
    r
    for r in experiment_runs(experiment["id"])
    if "Did I receive my paycheck this week?" in json.dumps(r["example"]["revision"]["input"])
]
write_answer(f"trace {run['traceId']} in project {experiment['project_name']}")
