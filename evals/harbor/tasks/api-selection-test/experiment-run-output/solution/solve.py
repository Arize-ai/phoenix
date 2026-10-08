#!/usr/bin/env python3
"""Output and verdict of one experiment run"""

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
    "banking_saas_dataset_clean", "safe-sql prompt v3 authorization fix"
)
(run,) = [
    r
    for r in get_experiment_runs(experiment["id"])
    if "Did I receive my paycheck this week?" in json.dumps(r.example.revision.input)
]
output = run.output
output = output.get("task_output", output)  # REST and GraphQL unwrap the task output
answer = output["messages"][0]["content"]
verdicts = ", ".join(
    f"{a.node.name} {a.node.label} ({a.node.score:g})" for a in run.annotations.edges
)
write_answer(f"it answered {answer!r}; {verdicts}")
