#!/usr/bin/env python3
"""Lookup of a prompt that does not exist"""

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

version = rest("/prompts/customer-support-agent/latest", missing_ok=True)
write_answer(
    "no prompt named customer-support-agent exists"
    if version is None
    else version["data"]["model_name"]
)
