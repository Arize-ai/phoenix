#!/usr/bin/env python3
"""Repetitions of an experiment"""

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

write_answer(
    str(
        experiment_by_name("banking_saas_dataset_clean", "safe-sql prompt v4 disambiguation")[
            "repetitions"
        ]
    )
)
