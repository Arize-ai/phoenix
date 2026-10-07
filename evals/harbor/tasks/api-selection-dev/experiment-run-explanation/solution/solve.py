#!/usr/bin/env python3
"""Why one experiment run failed its evaluator"""

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

experiment = experiment_by_name(
    "github-support-triage-tool-routing", "Luna first-tool routing — validated evaluator"
)
(run,) = [
    r
    for r in experiment_runs(experiment["id"])
    if "Dark mode" in r["example"]["revision"]["input"]["ticket"]
]
write_answer(
    "; ".join(f"{a['name']} {a['label']}: {a['explanation']}" for a in run["annotations"])
    + f" (run {run['id']})"
)
