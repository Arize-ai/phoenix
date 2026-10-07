#!/usr/bin/env python3
"""Custom model providers"""

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

providers = rest_pages("/custom_model_providers", limit=100)
write_answer("none" if not providers else ", ".join(p.get("name", str(p)) for p in providers))
