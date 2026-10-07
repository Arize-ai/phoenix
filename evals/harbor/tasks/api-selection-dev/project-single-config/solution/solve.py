#!/usr/bin/env python3
"""The one annotation config on pxi_dev"""

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

(config,) = rest_pages("/projects/pxi_dev/annotation_configs")
values = ", ".join(f"{v['label']} = {v['score']:g}" for v in config["values"])
write_answer(f"{config['name']}: {config['optimization_direction']} ({values})")
