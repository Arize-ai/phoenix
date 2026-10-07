#!/usr/bin/env python3
"""Session of a trace"""

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
    "query($t: String!) { getTraceByOtelId(traceId: $t) { session { sessionId } } }",
    {"t": "9128cef0af42a378c2123858a6a1ce26"},
)["getTraceByOtelId"]
write_answer(trace["session"]["sessionId"])
