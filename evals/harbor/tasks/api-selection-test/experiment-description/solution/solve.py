#!/usr/bin/env python3
"""Description of a named experiment"""

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

experiment = experiment_by_name(
    "banking_saas_dataset_clean", "safe-sql prompt v3 authorization fix"
)
write_answer(str(experiment["description"]))
