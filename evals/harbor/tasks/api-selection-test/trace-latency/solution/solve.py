#!/usr/bin/env python3
"""End-to-end latency of a trace"""

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
    "query($t: String!) { getTraceByOtelId(traceId: $t) { latencyMs } }",
    {"t": "660d6a9fe57e74b3b64d7e075d20ec78"},
)
ms = trace["getTraceByOtelId"]["latencyMs"]
write_answer(f"{ms / 1000:g} seconds ({ms:g} ms)")
