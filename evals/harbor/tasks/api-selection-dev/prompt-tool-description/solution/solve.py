#!/usr/bin/env python3
"""Description of one tool in a prompt"""

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

version = rest("/prompts/github-support-ticket-triage-agent/latest")["data"]
(tool,) = [t for t in version["tools"]["tools"] if t["function"]["name"] == "get_github_issue"]
write_answer(str(tool["function"]["description"]))
