#!/usr/bin/env python3
"""Final answer of a trace"""

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
    "query($t: String!) { getTraceByOtelId(traceId: $t) { rootSpan { output { value } } } }",
    {"t": "8b3f5b1f7b0fac4b6a24eb131210b072"},
)["getTraceByOtelId"]
write_answer(trace["rootSpan"]["output"]["value"][:400])
