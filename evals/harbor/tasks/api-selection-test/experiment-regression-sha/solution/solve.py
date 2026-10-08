#!/usr/bin/env python3
"""Git commit recorded on a regression experiment"""

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

experiment = get_experiment_by_name("set_spans_filter", "set_span-64502b8e")
count = graphql(
    "query($id: ID!) { node(id: $id) { ... on Experiment { runCount } } }", {"id": experiment["id"]}
)["node"]["runCount"]
write_answer(
    f"{experiment['metadata'].get('git_sha')} (model {experiment['metadata'].get('model')}), {count} runs"
)
