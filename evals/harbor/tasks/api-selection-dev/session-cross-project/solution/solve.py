#!/usr/bin/env python3
"""A session whose traces span two projects"""

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
    "query($s: String!) { getProjectSessionById(sessionId: $s) { numTraces project { name } traces(first: 100) { edges { node { project { name } } } } } }",
    {"s": "incident-2026-08-06-checkout"},
)["getProjectSessionById"]
counts = Counter(e["node"]["project"]["name"] for e in session["traces"]["edges"])
write_answer(
    f"{session['numTraces']} traces in total: "
    + ", ".join(f"{n} in {name}" for name, n in counts.most_common())
    + f" (the session itself belongs to {session['project']['name']})"
)
