#!/usr/bin/env python3
"""Error message and model of a failed trace"""

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
        "query($t: String!) { getTraceByOtelId(traceId: $t) { spans(first: 100) { edges { node { name statusCode statusMessage attributes } } } } }",
        {"t": "914e1f100fba1951ff06323e13f514cb"},
    )["getTraceByOtelId"]["spans"]["edges"]
]
errors = [s for s in spans if s["statusCode"] == "ERROR"]
models = sorted({attribute(s["attributes"], "llm.model_name") for s in spans} - {None})
write_answer(
    f"status message {errors[0]['statusMessage']!r} on {', '.join(s['name'] for s in errors)}; "
    f"model {', '.join(models)}"
)
