#!/usr/bin/env python3
"""Note on the latest version of the triage prompt"""

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
write_answer(f"{version['description']!r}; model {version['model_name']}")
