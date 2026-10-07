#!/usr/bin/env python3
"""Description of a hidden experiment project"""

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

project = rest("/projects/Experiment-e2b97126b637414e0545df8d")["data"]
write_answer(str(project["description"]))
