#!/usr/bin/env python3
"""Prompt labels and where they are applied"""

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

labels = [
    e["node"]
    for e in graphql("{ promptLabels { edges { node { name color description } } } }")[
        "promptLabels"
    ]["edges"]
]
prompts = [
    e["node"]
    for e in graphql("{ prompts(first: 100) { edges { node { name labels { name } } } } }")[
        "prompts"
    ]["edges"]
]
(label,) = [item for item in labels if item["name"] == "evaluator"]
tagged = [p["name"] for p in prompts if any(item["name"] == "evaluator" for item in p["labels"])]
write_answer(f"{', '.join(tagged)}; colour {label['color']}; {label['description']!r}")
