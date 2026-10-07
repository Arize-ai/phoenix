#!/usr/bin/env python3
"""Run without an evaluation in an experiment"""

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

runs = [r for r in experiment_runs("RXhwZXJpbWVudDoxMDE=") if not r["annotations"]]
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
        f"case {r['example']['revision']['metadata'].get('case')} (example {r['example']['id']}, trace {r['traceId']})"
        for r in runs
    )
    + f"; job log: {logs}"
)
