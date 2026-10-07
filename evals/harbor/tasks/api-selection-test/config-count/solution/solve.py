#!/usr/bin/env python3
"""Number of annotation configs and the undescribed one"""

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

configs = rest_pages("/annotation_configs", limit=100)
missing = [c["name"] for c in configs if not c.get("description")]
write_answer(f"{len(configs)} configs; without a description: {', '.join(missing) or 'none'}")
