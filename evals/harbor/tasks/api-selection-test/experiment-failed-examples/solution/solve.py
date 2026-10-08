#!/usr/bin/env python3
"""Scenarios that failed an experiment's evaluator"""

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
runs = get_experiment_runs(experiment["id"])
failed = sorted(
    r.example.revision.metadata["scenario"]
    for r in runs
    if any(
        a.node.name == "first_tool_matches_expected" and a.node.score == 0
        for a in r.annotations.edges
    )
)
write_answer(f"{len(failed)} of {len(runs)}: " + ", ".join(failed))
