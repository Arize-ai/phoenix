#!/usr/bin/env python3
"""Observation appended to an experiment's metadata"""

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
(observation,) = experiment["metadata"]["observations"]
write_answer(f"at {observation['at']}, by {observation['by']}: {observation['note'][:300]!r}")
