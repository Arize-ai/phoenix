#!/usr/bin/env python3
"""The seeded project's trace count, as Phoenix reports it."""

import sys

sys.path.insert(0, "/opt/verifier")

from evals.harbor.lib.phoenix_query import graphql, write_answer

edges = graphql("{ projects(first: 100) { edges { node { name traceCount } } } }")["projects"][
    "edges"
]
write_answer(
    str(next(e["node"]["traceCount"] for e in edges if e["node"]["name"] == "research-assistant"))
)
