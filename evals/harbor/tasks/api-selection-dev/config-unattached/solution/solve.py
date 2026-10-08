#!/usr/bin/env python3
"""Whether every annotation config is attached to a project"""

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

configs = {c["name"] for c in rest_pages("/annotation_configs", limit=100)}
attached: dict[str, list[str]] = {}
for project in rest_pages("/projects", limit=100):
    for config in rest_pages(f"/projects/{project['id']}/annotation_configs", limit=100):
        attached.setdefault(config["name"], []).append(project["name"])
unattached = sorted(configs - set(attached))
write_answer(
    ("yes, every config is attached: " if not unattached else f"no, unattached: {unattached}; ")
    + "; ".join(f"{name} -> {', '.join(sorted(set(p)))}" for name, p in sorted(attached.items()))
)
