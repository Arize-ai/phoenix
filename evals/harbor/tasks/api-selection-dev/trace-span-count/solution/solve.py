#!/usr/bin/env python3
"""Span count and root span of a trace"""

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
    "query($t: String!) { getTraceByOtelId(traceId: $t) { numSpans rootSpan { name } } }",
    {"t": "90122be24041d5549b6d109614dd459f"},
)["getTraceByOtelId"]
write_answer(f"{trace['numSpans']} spans, root span {trace['rootSpan']['name']}")
