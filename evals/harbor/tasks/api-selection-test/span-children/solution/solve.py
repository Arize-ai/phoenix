#!/usr/bin/env python3
"""Direct children of a span"""

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
    "query($s: String!) { getSpanByOtelId(spanId: $s) { descendants(maxDepth: 1, first: 50) { edges { node { spanId name spanKind } } } } }",
    {"s": "6a41eb4766c2bb30"},
)["getSpanByOtelId"]
children = [e["node"] for e in span["descendants"]["edges"]]
write_answer(", ".join(f"{c['spanId']} ({c['name']}, {c['spanKind'].upper()})" for c in children))
