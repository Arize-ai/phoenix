#!/usr/bin/env python3
"""Number of registered models"""

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

models = generative_models()
kinds = Counter(m["kind"] for m in models)
write_answer(
    f"{len(models)} models: " + ", ".join(f"{n} {kind}" for kind, n in sorted(kinds.items()))
)
