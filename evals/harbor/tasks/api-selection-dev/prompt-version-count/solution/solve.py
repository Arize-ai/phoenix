#!/usr/bin/env python3
"""Version count of a prompt and what the second changed"""

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

name = "secure-sql-generation-assistant-for-a-banking-saas-application-given-a-n_36"
versions = sorted(rest_pages(f"/prompts/{name}/versions", limit=100), key=lambda v: rowid(v["id"]))
write_answer(f"{len(versions)} versions; the second: {versions[1]['description']!r}")
