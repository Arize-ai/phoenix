#!/usr/bin/env python3
"""Exception event on a tool span"""

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
    "query($s: String!) { getSpanByOtelId(spanId: $s) { name events { name attributes } } }",
    {"s": "f8458c42e0719727"},
)["getSpanByOtelId"]
events = [e["attributes"] for e in span["events"] if e["name"] == "exception"]
write_answer(
    "; ".join(f"{a.get('exception.type')}: {a.get('exception.message')}" for a in events)
    + f" (span {span['name']})"
)
