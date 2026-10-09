#!/usr/bin/env python3
"""Run without an evaluation in an experiment"""

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

runs = [r for r in get_experiment_runs("RXhwZXJpbWVudDoxMDE=") if not r.annotations.edges]
job = graphql(
    "query($id: ID!) { node(id: $id) { ... on Experiment { job { status errors(first: 50) { edges { node { category level message } } } } } } }",
    {"id": "RXhwZXJpbWVudDoxMDE="},
)["node"]["job"]
logs = "; ".join(
    f"{e['node']['category']} {e['node']['level']} {e['node']['message']}"
    for e in job["errors"]["edges"]
)
write_answer(
    "; ".join(
        f"case {r.example.revision.metadata.get('case')} (example {r.example.id}, trace {r.trace_id})"
        for r in runs
    )
    + f"; job log: {logs}"
)
