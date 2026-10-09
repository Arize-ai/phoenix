#!/usr/bin/env python3
"""Description of a named project"""

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

project = rest("/projects/dataset-evaluator-a629a8ba9fc497a33297f9d8")["data"]
write_answer(f"{project['name']}: {project['description']}")
