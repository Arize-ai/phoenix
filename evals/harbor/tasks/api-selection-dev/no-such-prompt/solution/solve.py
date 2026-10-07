#!/usr/bin/env python3
"""Lookup of a prompt that does not exist"""

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

version = rest("/prompts/customer-support-agent/latest", missing_ok=True)
write_answer(
    "no prompt named customer-support-agent exists"
    if version is None
    else version["data"]["model_name"]
)
