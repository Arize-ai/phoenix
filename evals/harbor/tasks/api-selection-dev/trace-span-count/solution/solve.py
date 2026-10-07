#!/usr/bin/env python3
"""Span count and root span of a trace"""

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
    "query($t: String!) { getTraceByOtelId(traceId: $t) { numSpans rootSpan { name } } }",
    {"t": "90122be24041d5549b6d109614dd459f"},
)["getTraceByOtelId"]
write_answer(f"{trace['numSpans']} spans, root span {trace['rootSpan']['name']}")
