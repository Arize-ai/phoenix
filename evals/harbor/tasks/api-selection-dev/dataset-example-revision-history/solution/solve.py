#!/usr/bin/env python3
"""Revision history of a dataset example"""

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

did = get_dataset_id_from_name("PXI E2E Agent Tests")
versions = sorted(
    (
        e["node"]["id"]
        for e in graphql(
            "query($id: ID!) { node(id: $id) { ... on Dataset { versions(first: 50) { edges { node { id } } } } } }",
            {"id": did},
        )["node"]["versions"]["edges"]
    ),
    key=rowid,
)
current = graphql(
    "query($id: ID!) { node(id: $id) { ... on Dataset { examples(first: 100) { edges { node { id revision { input metadata } } } } } } }",
    {"id": did},
)["node"]
(example,) = [
    e["node"]
    for e in current["examples"]["edges"]
    if "PHOENIX_PROJECT_NAME" in json.dumps(e["node"]["revision"])
    or "project name" in json.dumps(e["node"]["revision"]["input"])
]
REVISION = "query($id: ID!, $v: ID!) { node(id: $id) { ... on DatasetExample { revision(datasetVersionId: $v) { input metadata } } } }"
seen = []
for version in versions:
    revision = graphql(REVISION, {"id": example["id"], "v": version})["node"]["revision"]
    if not seen or revision != seen[-1]:
        seen.append(revision)
write_answer(
    f"{len(seen)} revisions; current prompt {seen[-1]['input'].get('prompt')!r} "
    f"(scenario {seen[-1]['metadata'].get('scenario')}, example {example['id']})"
)
