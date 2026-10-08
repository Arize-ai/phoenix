#!/usr/bin/env python3
"""Where the error status sits in a failed trace"""

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
        "query($t: String!) { getTraceByOtelId(traceId: $t) { spans(first: 100) { edges { node { spanId name parentId statusCode propagatedStatusCode statusMessage } } } } }",
        {"t": "914e1f100fba1951ff06323e13f514cb"},
    )["getTraceByOtelId"]["spans"]["edges"]
]
parts = [
    f"{'root' if s['parentId'] is None else 'child'} span {s['spanId']} ({s['name']}): "
    f"own status {s['statusCode']}, propagated {s['propagatedStatusCode']}, message {s['statusMessage']!r}"
    for s in sorted(spans, key=lambda s: s["parentId"] is not None)
]
write_answer("; ".join(parts))
