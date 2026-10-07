#!/usr/bin/env python3
"""User input of a trace"""

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

trace = graphql(
    "query($t: String!) { getTraceByOtelId(traceId: $t) { project { name } rootSpan { name input { value } } } }",
    {"t": "53e43018f088a7d5242e29712b3e3351"},
)["getTraceByOtelId"]
root = trace["rootSpan"]
write_answer(
    f"{root['input']['value']} (project {trace['project']['name']}, root span {root['name']})"
)
