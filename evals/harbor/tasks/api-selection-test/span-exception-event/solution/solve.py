#!/usr/bin/env python3
"""Exception event on a tool span"""

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
    "query($s: String!) { getSpanByOtelId(spanId: $s) { name events { name attributes } } }",
    {"s": "f8458c42e0719727"},
)["getSpanByOtelId"]
events = [e["attributes"] for e in span["events"] if e["name"] == "exception"]
write_answer(
    "; ".join(f"{a.get('exception.type')}: {a.get('exception.message')}" for a in events)
    + f" (span {span['name']})"
)
