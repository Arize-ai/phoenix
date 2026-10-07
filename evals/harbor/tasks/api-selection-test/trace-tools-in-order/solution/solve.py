#!/usr/bin/env python3
"""Tool calls of a trace in order"""

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

spans = rest_pages(
    "/projects/incident-copilot/spans", trace_id="90122be24041d5549b6d109614dd459f", limit=1000
)
tools = [
    s["name"]
    for s in sorted(spans, key=lambda s: s["start_time"])
    if s["span_kind"].upper() == "TOOL"
]
write_answer(", ".join(tools) + f" ({len(tools)} tool calls, {len(set(tools))} distinct tools)")
