#!/usr/bin/env python3
"""Description of a named project"""

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

project = rest("/projects/dataset-evaluator-a629a8ba9fc497a33297f9d8")["data"]
write_answer(f"{project['name']}: {project['description']}")
