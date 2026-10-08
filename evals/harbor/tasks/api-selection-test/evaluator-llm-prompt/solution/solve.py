#!/usr/bin/env python3
"""Prompt and tag behind an LLM evaluator"""

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

(evaluator,) = [
    e["node"]
    for e in graphql(
        "{ evaluators(first: 100) { edges { node { name ... on LLMEvaluator {"
        " prompt { id name } promptVersionTag { name promptVersionId } } } } } }"
    )["evaluators"]["edges"]
    if e["node"]["name"] == "initial_response_alignment"
]
tag = evaluator["promptVersionTag"]
write_answer(
    f"prompt {evaluator['prompt']['name']} ({evaluator['prompt']['id']}), "
    f"tag {tag['name']} on version {tag['promptVersionId']}"
)
