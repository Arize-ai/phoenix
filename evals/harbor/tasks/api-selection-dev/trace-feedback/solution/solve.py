#!/usr/bin/env python3
"""User feedback annotation on a trace"""

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

annotations = rest_pages(
    "/projects/pxi_dev/trace_annotations", trace_ids="f5c12f6ca357b515bd3fa701306cb760", limit=100
)
write_answer(
    "; ".join(
        f"{a['name']} = {a['result']['label']} (score {a['result']['score']:g}, "
        f"{a['annotator_kind']}, via {a['source']})"
        for a in annotations
    )
)
