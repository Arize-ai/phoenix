#!/usr/bin/env python3
"""Observation appended to an experiment's metadata"""

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

experiment = experiment_by_name("banking_saas_dataset_clean", "safe-sql prompt v4 disambiguation")
(observation,) = experiment["metadata"]["observations"]
write_answer(f"at {observation['at']}, by {observation['by']}: {observation['note'][:300]!r}")
