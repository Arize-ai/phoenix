#!/usr/bin/env python3
"""Length and span of a pxi_dev session"""

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

session = graphql(
    "query($s: String!) { getProjectSessionById(sessionId: $s) { numTraces startTime endTime } }",
    {"s": "c07e3780-9929-40ff-9465-9e8b30eb1656"},
)["getProjectSessionById"]
write_answer(
    f"{session['numTraces']} traces, from {utc(session['startTime'])} to {utc(session['endTime'])}"
)
