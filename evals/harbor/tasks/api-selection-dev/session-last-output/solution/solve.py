#!/usr/bin/env python3
"""Last assistant output of a session"""

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
    "query($s: String!) { getProjectSessionById(sessionId: $s) { numTraces lastOutput { value } } }",
    {"s": "onboarding-walkthrough-77"},
)["getProjectSessionById"]
write_answer(f"{session['lastOutput']['value']} ({session['numTraces']} traces)")
