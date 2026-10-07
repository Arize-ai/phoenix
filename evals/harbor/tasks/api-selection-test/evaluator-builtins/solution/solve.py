#!/usr/bin/env python3
"""Names of the built-in evaluators"""

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
    ", ".join(
        sorted(e["name"] for e in graphql("{ builtInEvaluators { name } }")["builtInEvaluators"])
    )
)
