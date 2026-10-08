#!/usr/bin/env python3
"""Hypothesis and baseline of an experiment"""

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

experiment = get_experiment_by_name(
    "banking_saas_dataset_clean", "safe-sql prompt v4 disambiguation"
)
baseline_id = experiment["metadata"]["baseline_experiment_id"]
baseline = rest(f"/experiments/{baseline_id}")["data"]
write_answer(
    f"{experiment['metadata']['hypothesis']!r}; baseline {baseline_id} ({baseline['name']})"
)
