#!/usr/bin/env python3
"""Annotation configs attached to a project"""

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

names = sorted(c["name"] for c in rest_pages("/projects/mobile-review-queue/annotation_configs"))
write_answer(f"{len(names)} configs: " + ", ".join(names))
