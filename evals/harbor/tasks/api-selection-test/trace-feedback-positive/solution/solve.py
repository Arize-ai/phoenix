#!/usr/bin/env python3
"""Traces with positive user feedback in a project"""

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

traces = rest_pages(
    "/projects/pxi_dev/traces",
    filter="trace_annotations['user_feedback'].label == 'positive'",
    sort="start_time",
    order="asc",
    limit=1000,
)
write_answer(f"{len(traces)} traces: " + ", ".join(t["trace_id"] for t in traces))
