#!/usr/bin/env python3
"""Dataset version an experiment ran against"""

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

experiment = experiment_by_name(
    "github-support-triage-tool-routing", "Luna first-tool routing baseline"
)
(version,) = [
    v
    for v in rest_pages(f"/datasets/{experiment['dataset_id']}/versions", limit=100)
    if v["version_id"] == experiment["dataset_version_id"]
]
write_answer(f"version {version['version_id']}: {version['description']!r}")
