#!/usr/bin/env python3
"""Number of registered models"""

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

models = get_generative_models()
kinds = Counter(m.kind.value for m in models)
write_answer(
    f"{len(models)} models: " + ", ".join(f"{n} {kind}" for kind, n in sorted(kinds.items()))
)
