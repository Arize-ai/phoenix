#!/usr/bin/env python3
"""Lookup of a trace that does not exist"""

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
    "query($t: String!) { getTraceByOtelId(traceId: $t) { rootSpan { name } } }",
    {"t": "00000000000000000000000000000000"},
)["getTraceByOtelId"]
write_answer(
    "there is no trace with that id" if trace is None else f"root span {trace['rootSpan']['name']}"
)
