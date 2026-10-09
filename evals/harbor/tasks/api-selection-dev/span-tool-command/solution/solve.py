#!/usr/bin/env python3
"""Command and failure of a bash span"""

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
    "query($s: String!) { getSpanByOtelId(spanId: $s) { statusMessage input { value } } }",
    {"s": "0e5512ce48261dcc"},
)["getSpanByOtelId"]
command = json.loads(span["input"]["value"])
write_answer(
    f"status {span['statusMessage'].strip(': ')}; summary {command.get('summary')!r}; "
    f"command {command.get('command', '')[:200]!r}"
)
