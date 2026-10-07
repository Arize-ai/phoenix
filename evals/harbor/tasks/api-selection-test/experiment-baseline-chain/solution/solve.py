#!/usr/bin/env python3
"""Baseline chain of an experiment"""

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
chain = []
while experiment:
    chain.append(f"{experiment['id']} ({experiment['name']})")
    baseline = experiment["metadata"].get("baseline_experiment_id")
    experiment = rest(f"/experiments/{baseline}")["data"] if baseline else None
write_answer(" -> ".join(chain))
