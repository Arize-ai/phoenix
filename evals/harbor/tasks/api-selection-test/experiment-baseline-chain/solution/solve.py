#!/usr/bin/env python3
"""Baseline chain of an experiment"""

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
chain = []
while experiment:
    chain.append(f"{experiment['id']} ({experiment['name']})")
    baseline = experiment["metadata"].get("baseline_experiment_id")
    experiment = rest(f"/experiments/{baseline}")["data"] if baseline else None
write_answer(" -> ".join(chain))
