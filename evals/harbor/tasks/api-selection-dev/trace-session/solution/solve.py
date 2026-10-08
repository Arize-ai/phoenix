#!/usr/bin/env python3
"""Session of a trace"""

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
    "query($t: String!) { getTraceByOtelId(traceId: $t) { session { sessionId } } }",
    {"t": "9128cef0af42a378c2123858a6a1ce26"},
)["getTraceByOtelId"]
write_answer(trace["session"]["sessionId"])
