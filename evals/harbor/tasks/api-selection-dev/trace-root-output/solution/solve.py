#!/usr/bin/env python3
"""Final answer of a trace"""

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
    "query($t: String!) { getTraceByOtelId(traceId: $t) { rootSpan { output { value } } } }",
    {"t": "8b3f5b1f7b0fac4b6a24eb131210b072"},
)["getTraceByOtelId"]
write_answer(trace["rootSpan"]["output"]["value"][:400])
