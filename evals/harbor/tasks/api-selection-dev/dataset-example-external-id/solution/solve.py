#!/usr/bin/env python3
"""Example found by its pytest node id and the version that added it"""

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

did = get_dataset_id_from_name("experiment_observations")
examples = rest(f"/datasets/{did}/examples")["data"]["examples"]
(example,) = [
    e
    for e in examples
    if str(e["metadata"].get("pytest_nodeid", "")).rstrip("]").endswith("compare-only-no-patch")
]
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
MEMBERS = "query($id: ID!, $v: ID!) { node(id: $id) { ... on Dataset { examples(datasetVersionId: $v, first: 100) { edges { node { id } } } } } }"
for index, version in enumerate(versions, start=1):
    members = {
        e["node"]["id"]
        for e in graphql(MEMBERS, {"id": did, "v": version})["node"]["examples"]["edges"]
    }
    if example["node_id"] in members:
        break
write_answer(
    f"example {example['node_id']}, added in version {index} of {len(versions)} (version id {rowid(version)})"
)
