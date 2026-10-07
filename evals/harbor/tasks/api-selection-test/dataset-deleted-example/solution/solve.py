#!/usr/bin/env python3
"""Example deleted and added between dataset versions"""

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

did = dataset_id("banking_saas_dataset_auto_ids")
versions = sorted(
    (
        e["node"]
        for e in graphql(
            "query($id: ID!) { node(id: $id) { ... on Dataset { versions(first: 50) { edges { node { id } } } } } }",
            {"id": did},
        )["node"]["versions"]["edges"]
    ),
    key=lambda v: rowid(v["id"]),
)
EXAMPLES = (
    "query($id: ID!, $v: ID!) { node(id: $id) { ... on Dataset { examples(datasetVersionId: $v, first: 100)"
    " { edges { node { id revision(datasetVersionId: $v) { input revisionKind } } } } } } }"
)


def examples(version_id):
    page = graphql(EXAMPLES, {"id": did, "v": version_id})["node"]["examples"]["edges"]
    return {e["node"]["id"]: e["node"]["revision"] for e in page}


first, second, third = (examples(v["id"]) for v in versions[:3])
deleted = sorted(set(first) - set(second))
created = sorted(set(second) - set(first))
patched = [i for i in created if i in third and third[i]["input"] != second[i]["input"]]
text = lambda rev: json.dumps(rev["input"])[:120]  # noqa: E731
write_answer(
    f"version {rowid(versions[1]['id'])} deleted {', '.join(deleted) or 'nothing'} and created "
    + ", ".join(f"{i} ({text(second[i])})" for i in created)
    + f"; version {rowid(versions[2]['id'])} patched "
    + (", ".join(f"{i} to {text(third[i])}" for i in patched) or "nothing")
)
