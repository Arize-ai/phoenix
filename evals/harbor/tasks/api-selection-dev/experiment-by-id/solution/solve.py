#!/usr/bin/env python3
"""Name and dataset of an experiment id"""

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

experiment = rest("/experiments/RXhwZXJpbWVudDoxMzY=")["data"]
dataset = rest(f"/datasets/{experiment['dataset_id']}")["data"]
write_answer(f"{experiment['name']}, on dataset {dataset['name']}")
