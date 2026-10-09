#!/usr/bin/env python3
"""Number of annotation configs and the undescribed one"""

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

configs = rest_pages("/annotation_configs", limit=100)
missing = [c["name"] for c in configs if not c.get("description")]
write_answer(f"{len(configs)} configs; without a description: {', '.join(missing) or 'none'}")
