#!/usr/bin/env python3
"""Model change between two prompt versions"""

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

name = "phoenix-issue-reproduction-and-triage-agent-your-job-is-to-turn-an-unstr_4"
versions = sorted(rest_pages(f"/prompts/{name}/versions", limit=100), key=lambda v: rowid(v["id"]))
write_answer(
    " -> ".join(v["model_name"] for v in versions)
    + "; notes: "
    + "; ".join(repr(v["description"] or "") for v in versions)
)
