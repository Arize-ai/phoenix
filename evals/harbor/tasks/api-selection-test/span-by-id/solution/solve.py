#!/usr/bin/env python3
"""Name, kind, and project of a span"""

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

span = graphql(
    "query($s: String!) { getSpanByOtelId(spanId: $s) { name spanKind trace { traceId project { name } } } }",
    {"s": "c131b0bee8049eb2"},
)["getSpanByOtelId"]
write_answer(
    f"{span['name']}, a {span['spanKind'].upper()} span, in project {span['trace']['project']['name']} "
    f"(trace {span['trace']['traceId']})"
)
