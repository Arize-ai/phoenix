#!/usr/bin/env python3
"""Traces that errored in a session"""

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
    "query($s: String!) { getProjectSessionById(sessionId: $s) { numTraces numTracesWithError traces(first: 100) { edges { node { traceId errorCount } } } } }",
    {"s": "chaotic-eval-run-51"},
)["getProjectSessionById"]
errored = [e["node"]["traceId"] for e in session["traces"]["edges"] if e["node"]["errorCount"]]
write_answer(f"{session['numTracesWithError']} of {session['numTraces']}: " + ", ".join(errored))
