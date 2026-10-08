#!/usr/bin/env python3
"""Token counts and model of an LLM span"""

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

span = graphql(
    "query($s: String!) { getSpanByOtelId(spanId: $s) { tokenCountPrompt tokenCountCompletion attributes } }",
    {"s": "24aed90fbeebb7c2"},
)["getSpanByOtelId"]
write_answer(
    f"{span['tokenCountPrompt']} prompt tokens, {span['tokenCountCompletion']} completion tokens, "
    f"model {get_nested_attribute(span['attributes'], 'llm.model_name')}"
)
