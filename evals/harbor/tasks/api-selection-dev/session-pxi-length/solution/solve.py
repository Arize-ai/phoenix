#!/usr/bin/env python3
"""Length and span of a pxi_dev session"""

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

session = graphql(
    "query($s: String!) { getProjectSessionById(sessionId: $s) { numTraces startTime endTime } }",
    {"s": "c07e3780-9929-40ff-9465-9e8b30eb1656"},
)["getProjectSessionById"]
write_answer(
    f"{session['numTraces']} traces, from {format_utc_timestamp(session['startTime'])} to {format_utc_timestamp(session['endTime'])}"
)
