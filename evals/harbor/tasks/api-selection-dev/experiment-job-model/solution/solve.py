#!/usr/bin/env python3
"""Model and prompt version an experiment job ran"""

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
