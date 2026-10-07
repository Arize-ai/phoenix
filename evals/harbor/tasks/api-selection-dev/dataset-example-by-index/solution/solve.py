#!/usr/bin/env python3
"""Metadata of a dataset example found by its input"""

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

examples = rest(f"/datasets/{dataset_id('phoenix-issue-triage-initial-responses')}/examples")
(example,) = [
    e
    for e in examples["data"]["examples"]
    if str(e["input"].get("issue", "")).startswith("https://github.com/")
]
meta = example["metadata"]
write_answer(
    f"case {meta['case']}, should_ask_question {str(meta['should_ask_question']).lower()} "
    f"(example {example['node_id']})"
)
