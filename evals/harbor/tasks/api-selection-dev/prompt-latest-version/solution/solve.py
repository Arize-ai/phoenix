#!/usr/bin/env python3
"""Model and note of a prompt's latest version"""

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

version = rest("/prompts/pxi-system-prompt/latest")["data"]
write_answer(f"{version['model_name']} ({version['model_provider']}); {version['description']!r}")
