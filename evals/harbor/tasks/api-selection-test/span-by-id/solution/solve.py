#!/usr/bin/env python3
"""Name, kind, and project of a span"""

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

span = graphql(
    "query($s: String!) { getSpanByOtelId(spanId: $s) { name spanKind trace { traceId project { name } } } }",
    {"s": "c131b0bee8049eb2"},
)["getSpanByOtelId"]
write_answer(
    f"{span['name']}, a {span['spanKind'].upper()} span, in project {span['trace']['project']['name']} "
    f"(trace {span['trace']['traceId']})"
)
