#!/usr/bin/env python3
"""How two refusal evaluators differ"""

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
