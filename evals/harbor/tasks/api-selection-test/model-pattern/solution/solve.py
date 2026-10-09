#!/usr/bin/env python3
"""Name pattern of a built-in model"""

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

(model,) = [m for m in get_generative_models() if m.name == "gpt-5.4-2026-03-05"]
write_answer(model.name_pattern)
