#!/usr/bin/env python3
"""Tools defined by a prompt"""

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

version = rest("/prompts/github-support-ticket-triage-agent/latest")["data"]
write_answer(", ".join(t["function"]["name"] for t in version["tools"]["tools"]))
