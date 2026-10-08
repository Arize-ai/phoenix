#!/usr/bin/env python3
"""Trace count and first input of a session"""

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
    "query($s: String!) { getProjectSessionById(sessionId: $s) { numTraces firstInput { value } } }",
    {"s": "support-billing-0142"},
)["getProjectSessionById"]
write_answer(f"{session['numTraces']} traces; first input {session['firstInput']['value']!r}")
