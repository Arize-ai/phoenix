#!/usr/bin/env python3
"""Error message and model of a failed trace"""

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
        "query($t: String!) { getTraceByOtelId(traceId: $t) { spans(first: 100) { edges { node { name statusCode statusMessage attributes } } } } }",
        {"t": "914e1f100fba1951ff06323e13f514cb"},
    )["getTraceByOtelId"]["spans"]["edges"]
]
errors = [s for s in spans if s["statusCode"] == "ERROR"]
models = sorted({get_nested_attribute(s["attributes"], "llm.model_name") for s in spans} - {None})
write_answer(
    f"status message {errors[0]['statusMessage']!r} on {', '.join(s['name'] for s in errors)}; "
    f"model {', '.join(models)}"
)
