#!/usr/bin/env python3
"""Version count of a prompt and what the second changed"""

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

name = "secure-sql-generation-assistant-for-a-banking-saas-application-given-a-n_36"
versions = sorted(rest_pages(f"/prompts/{name}/versions", limit=100), key=lambda v: rowid(v["id"]))
write_answer(f"{len(versions)} versions; the second: {versions[1]['description']!r}")
