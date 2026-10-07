#!/usr/bin/env python3
"""How two refusal evaluators differ"""

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

evaluators = {
    e["node"]["name"]: e["node"]["description"]
    for e in graphql("{ evaluators(first: 100) { edges { node { name description } } } }")[
        "evaluators"
    ]["edges"]
}
write_answer(
    f"refusal_detection: {evaluators['refusal_detection']!r}; "
    f"refusal_detection_fixed: {evaluators['refusal_detection_fixed']!r}"
)
