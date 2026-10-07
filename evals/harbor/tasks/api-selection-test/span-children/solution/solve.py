#!/usr/bin/env python3
"""Direct children of a span"""

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
    "query($s: String!) { getSpanByOtelId(spanId: $s) { descendants(maxDepth: 1, first: 50) { edges { node { spanId name spanKind } } } } }",
    {"s": "6a41eb4766c2bb30"},
)["getSpanByOtelId"]
children = [e["node"] for e in span["descendants"]["edges"]]
write_answer(", ".join(f"{c['spanId']} ({c['name']}, {c['spanKind'].upper()})" for c in children))
