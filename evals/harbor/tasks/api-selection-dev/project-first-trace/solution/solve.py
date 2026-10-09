#!/usr/bin/env python3
"""First and last trace times of a project"""

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

first = rest("/projects/pxi_agent_tony/traces", sort="start_time", order="asc", limit=1)
last = rest("/projects/pxi_agent_tony/traces", sort="start_time", order="desc", limit=1)
write_answer(
    f"first trace {format_utc_timestamp(first['data'][0]['start_time'])}, "
    f"last trace {format_utc_timestamp(last['data'][0]['start_time'])}"
)
