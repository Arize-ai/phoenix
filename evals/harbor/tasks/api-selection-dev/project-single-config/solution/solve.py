#!/usr/bin/env python3
"""The one annotation config on pxi_dev"""

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

(config,) = rest_pages("/projects/pxi_dev/annotation_configs")
values = ", ".join(f"{v['label']} = {v['score']:g}" for v in config["values"])
write_answer(f"{config['name']}: {config['optimization_direction']} ({values})")
