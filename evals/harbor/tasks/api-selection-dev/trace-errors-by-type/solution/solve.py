#!/usr/bin/env python3
"""Failed tool calls in a trace"""

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

spans = [
    e["node"]
    for e in graphql(
        "query($t: String!) { getTraceByOtelId(traceId: $t) { spans(first: 100) { edges { node { name statusCode statusMessage } } } } }",
        {"t": "176fcc3d88b18dabbf8db3449e53ebf2"},
    )["getTraceByOtelId"]["spans"]["edges"]
]
errors = [s for s in spans if s["statusCode"] == "ERROR"]
write_answer("; ".join(f"{s['name']}: {s['statusMessage']}" for s in errors))
