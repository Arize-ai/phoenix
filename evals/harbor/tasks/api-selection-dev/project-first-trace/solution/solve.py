#!/usr/bin/env python3
"""First and last trace times of a project"""

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

first = rest("/projects/pxi_agent_tony/traces", sort="start_time", order="asc", limit=1)
last = rest("/projects/pxi_agent_tony/traces", sort="start_time", order="desc", limit=1)
write_answer(
    f"first trace {utc(first['data'][0]['start_time'])}, "
    f"last trace {utc(last['data'][0]['start_time'])}"
)
