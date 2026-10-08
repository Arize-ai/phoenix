#!/usr/bin/env python3
"""Cumulative token count of a root span"""

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
    "query($t: String!) { getTraceByOtelId(traceId: $t) { numSpans rootSpan { spanId cumulativeTokenCountTotal cumulativeTokenCountPrompt cumulativeTokenCountCompletion } } }",
    {"t": "ff59da78f0cf706cd274464abcceab09"},
)["getTraceByOtelId"]
root = trace["rootSpan"]
write_answer(
    f"{root['cumulativeTokenCountTotal']:g} tokens ({root['cumulativeTokenCountPrompt']:g} prompt and "
    f"{root['cumulativeTokenCountCompletion']:g} completion) on span {root['spanId']}; "
    f"the trace has {trace['numSpans']} spans"
)
