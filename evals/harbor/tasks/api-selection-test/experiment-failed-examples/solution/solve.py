#!/usr/bin/env python3
"""Scenarios that failed an experiment's evaluator"""

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
runs = experiment_runs(experiment["id"])
failed = sorted(
    r["example"]["revision"]["metadata"]["scenario"]
    for r in runs
    if any(a["name"] == "first_tool_matches_expected" and a["score"] == 0 for a in r["annotations"])
)
write_answer(f"{len(failed)} of {len(runs)}: " + ", ".join(failed))
