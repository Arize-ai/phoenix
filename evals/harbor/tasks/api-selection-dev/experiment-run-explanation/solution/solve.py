#!/usr/bin/env python3
"""Why one experiment run failed its evaluator"""

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
    "github-support-triage-tool-routing", "Luna first-tool routing — validated evaluator"
)
(run,) = [
    r
    for r in get_experiment_runs(experiment["id"])
    if "Dark mode" in r.example.revision.input["ticket"]
]
write_answer(
    "; ".join(f"{a.node.name} {a.node.label}: {a.node.explanation}" for a in run.annotations.edges)
    + f" (run {run.id})"
)
