#!/usr/bin/env python3
"""Exception recorded on a trace"""

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
