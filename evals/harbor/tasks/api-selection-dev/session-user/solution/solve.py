#!/usr/bin/env python3
"""User id of a session"""

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
    "query($s: String!) { getProjectSessionById(sessionId: $s) { userId } }",
    {"s": "incident-2026-08-06-checkout"},
)
write_answer(str(session["getProjectSessionById"]["userId"]))
