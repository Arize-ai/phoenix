#!/usr/bin/env python3
"""Example count of a dataset"""

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

write_answer(
    str(rest(f"/datasets/{get_dataset_id_from_name('set_spans_filter')}")["data"]["example_count"])
)
