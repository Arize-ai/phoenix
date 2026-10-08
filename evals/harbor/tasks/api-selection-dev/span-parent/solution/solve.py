#!/usr/bin/env python3
"""Parent of a span"""

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

child = graphql(
    "query($s: String!) { getSpanByOtelId(spanId: $s) { parentId trace { traceId } } }",
    {"s": "ff3951eaa75f533d"},
)["getSpanByOtelId"]
parent = graphql(
    "query($s: String!) { getSpanByOtelId(spanId: $s) { name spanKind } }", {"s": child["parentId"]}
)["getSpanByOtelId"]
write_answer(
    f"span {child['parentId']}, {parent['name']} ({parent['spanKind'].upper()}), "
    f"in trace {child['trace']['traceId']}"
)
