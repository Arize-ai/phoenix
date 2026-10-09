#!/usr/bin/env python3
"""User input of a trace"""

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

trace = graphql(
    "query($t: String!) { getTraceByOtelId(traceId: $t) { project { name } rootSpan { name input { value } } } }",
    {"t": "53e43018f088a7d5242e29712b3e3351"},
)["getTraceByOtelId"]
root = trace["rootSpan"]
write_answer(
    f"{root['input']['value']} (project {trace['project']['name']}, root span {root['name']})"
)
