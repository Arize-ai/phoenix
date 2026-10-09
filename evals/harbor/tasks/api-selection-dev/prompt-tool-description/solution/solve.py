#!/usr/bin/env python3
"""Description of one tool in a prompt"""

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
(tool,) = [t for t in version["tools"]["tools"] if t["function"]["name"] == "get_github_issue"]
write_answer(str(tool["function"]["description"]))
