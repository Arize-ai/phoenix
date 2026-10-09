#!/usr/bin/env python3
"""Annotation configs attached to a project"""

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

names = sorted(c["name"] for c in rest_pages("/projects/mobile-review-queue/annotation_configs"))
write_answer(f"{len(names)} configs: " + ", ".join(names))
