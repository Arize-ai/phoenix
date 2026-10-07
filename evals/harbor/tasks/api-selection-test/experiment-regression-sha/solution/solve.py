#!/usr/bin/env python3
"""Git commit recorded on a regression experiment"""

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

experiment = experiment_by_name("set_spans_filter", "set_span-64502b8e")
count = graphql(
    "query($id: ID!) { node(id: $id) { ... on Experiment { runCount } } }", {"id": experiment["id"]}
)["node"]["runCount"]
write_answer(
    f"{experiment['metadata'].get('git_sha')} (model {experiment['metadata'].get('model')}), {count} runs"
)
