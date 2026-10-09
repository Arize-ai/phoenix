#!/usr/bin/env python3
"""Model and note of a prompt's latest version"""

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

version = rest("/prompts/pxi-system-prompt/latest")["data"]
write_answer(f"{version['model_name']} ({version['model_provider']}); {version['description']!r}")
