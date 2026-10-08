#!/usr/bin/env python3
"""Why an experiment stopped early and how its rerun scored"""

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

first = get_experiment_by_name("banking_saas_dataset_clean", "safe-sql prompt v1")
rerun = get_experiment_by_name("banking_saas_dataset_clean", "safe-sql prompt v1 rerun")
job = graphql(
    "query($id: ID!) { node(id: $id) { ... on Experiment { runCount job { status lastError { message } errors(first: 50) { edges { node { category message } } } } } } }",
    {"id": first["id"]},
)["node"]
summary = graphql(
    "query($id: ID!) { node(id: $id) { ... on Experiment { runCount annotationSummaries { annotationName meanScore count } } } }",
    {"id": rerun["id"]},
)["node"]
(scores,) = summary["annotationSummaries"]
logs = [e["node"] for e in job["job"]["errors"]["edges"]]
breaker = [log["message"] for log in logs if log["category"] == "EXPERIMENT"]
evals = [log for log in logs if log["category"] == "EVAL"]
write_answer(
    f"v1 ran {job['runCount']} examples and stopped: {'; '.join(breaker)} after {len(evals)} "
    f"evaluator errors ({', '.join(sorted({log['message'] for log in evals}))}); the rerun completed "
    f"{summary['runCount']} and {round(scores['meanScore'] * scores['count'])} passed {scores['annotationName']}"
)
