#!/usr/bin/env python3
"""Traces with positive user feedback in a project"""

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

traces = rest_pages(
    "/projects/pxi_dev/traces",
    filter="trace_annotations['user_feedback'].label == 'positive'",
    sort="start_time",
    order="asc",
    limit=1000,
)
write_answer(f"{len(traces)} traces: " + ", ".join(t["trace_id"] for t in traces))
