#!/usr/bin/env python3
"""Priced token types of a model"""

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

(model,) = [m for m in generative_models() if m["name"] == "gpt-4o"]
write_answer(", ".join(sorted(p["tokenType"] for p in model["tokenPrices"])))
