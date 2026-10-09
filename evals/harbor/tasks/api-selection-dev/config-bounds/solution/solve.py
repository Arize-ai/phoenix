#!/usr/bin/env python3
"""Bounds and direction of a continuous config"""

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

config = rest("/annotation_configs/response_quality")["data"]
write_answer(
    f"{config['type']}, from {config['lower_bound']:g} to {config['upper_bound']:g}, "
    f"{config['optimization_direction']}"
)
