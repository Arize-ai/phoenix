#!/usr/bin/env python3
"""Gradient colours of a project"""

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

project = graphql(
    '{ getProjectByName(name: "playground") { gradientStartColor gradientEndColor } }'
)["getProjectByName"]
write_answer(f"start {project['gradientStartColor']}, end {project['gradientEndColor']}")
