#!/usr/bin/env python3
"""All prompt version tags"""

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

prompts = [
    e["node"]
    for e in graphql(
        "{ prompts(first: 100) { edges { node { name versionTags { name promptVersionId } } } } }"
    )["prompts"]["edges"]
]
tags = [(p["name"], t["name"], t["promptVersionId"]) for p in prompts for t in p["versionTags"]]
write_answer(
    f"{len(tags)} tags: "
    + "; ".join(f"{tag} on version {version} of {prompt}" for prompt, tag, version in sorted(tags))
)
