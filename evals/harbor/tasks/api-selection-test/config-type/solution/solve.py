#!/usr/bin/env python3
"""Type and description of an annotation config"""

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

config = rest("/annotation_configs/review_summary")["data"]
write_answer(f"{config['type']}; {config['description']!r}")
