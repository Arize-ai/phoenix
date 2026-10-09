#!/usr/bin/env python3
"""Labels and scores of a categorical config"""

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

config = rest("/annotation_configs/px-mobile-verify-config")["data"]
values = ", ".join(f"{v['label']} = {v['score']:g}" for v in config["values"])
write_answer(
    f"{values} ({config['type']}, {config['optimization_direction']}, "
    f"described as {config['description']!r})"
)
