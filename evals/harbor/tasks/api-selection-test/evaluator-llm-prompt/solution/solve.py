#!/usr/bin/env python3
"""Prompt and tag behind an LLM evaluator"""

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
