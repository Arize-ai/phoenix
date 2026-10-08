#!/usr/bin/env python3
"""User id of a session"""

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
    "query($s: String!) { getProjectSessionById(sessionId: $s) { userId } }",
    {"s": "incident-2026-08-06-checkout"},
)
write_answer(str(session["getProjectSessionById"]["userId"]))
