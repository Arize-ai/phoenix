#!/usr/bin/env python3
"""Traces that errored in a session"""

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
    "query($s: String!) { getProjectSessionById(sessionId: $s) { numTraces numTracesWithError traces(first: 100) { edges { node { traceId errorCount } } } } }",
    {"s": "chaotic-eval-run-51"},
)["getProjectSessionById"]
errored = [e["node"]["traceId"] for e in session["traces"]["edges"] if e["node"]["errorCount"]]
write_answer(f"{session['numTracesWithError']} of {session['numTraces']}: " + ", ".join(errored))
