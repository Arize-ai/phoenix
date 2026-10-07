#!/usr/bin/env python3
"""Output and verdict of one experiment run"""

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
    "banking_saas_dataset_clean", "safe-sql prompt v3 authorization fix"
)
(run,) = [
    r
    for r in experiment_runs(experiment["id"])
    if "Did I receive my paycheck this week?" in json.dumps(r["example"]["revision"]["input"])
]
output = run["output"]
output = output.get("task_output", output)  # REST and GraphQL unwrap the task output
answer = output["messages"][0]["content"]
verdicts = ", ".join(f"{a['name']} {a['label']} ({a['score']:g})" for a in run["annotations"])
write_answer(f"it answered {answer!r}; {verdicts}")
