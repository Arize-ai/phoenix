#!/usr/bin/env python3
"""Metadata of a dataset example found by its input"""

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

examples = rest(
    f"/datasets/{get_dataset_id_from_name('phoenix-issue-triage-initial-responses')}/examples"
)
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
