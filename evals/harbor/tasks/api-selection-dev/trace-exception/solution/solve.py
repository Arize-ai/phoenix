#!/usr/bin/env python3
"""Exception recorded on a trace"""

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
        "query($t: String!) { getTraceByOtelId(traceId: $t) { spans(first: 100) { edges { node { spanId name events { name attributes } } } } } }",
        {"t": "72408774085db31572128f7e60b4f76d"},
    )["getTraceByOtelId"]["spans"]["edges"]
]
found = [(s, ev["attributes"]) for s in spans for ev in s["events"] if ev["name"] == "exception"]
write_answer(
    "; ".join(
        f"{a.get('exception.type')} on span {s['spanId']} ({s['name']}): "
        f"{str(a.get('exception.message'))[:160]}"
        for s, a in found
    )
)
