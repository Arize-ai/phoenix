#!/usr/bin/env python3
"""Model and prompt version an experiment job ran"""

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

job = graphql(
    "query($id: ID!) { node(id: $id) { ... on Experiment { job { taskConfig { prompt { modelName modelProvider promptVersion { id sequenceNumber } } } } } } }",
    {"id": "RXhwZXJpbWVudDoxMzY="},
)["node"]["job"]
prompt = job["taskConfig"]["prompt"]
version = prompt["promptVersion"]
write_answer(
    f"{prompt['modelName']} ({prompt['modelProvider']}) with prompt version {version['id']} "
    f"(sequence number {version['sequenceNumber']})"
)
