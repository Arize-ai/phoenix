#!/usr/bin/env python3
"""Gradient colours of a project"""

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

project = graphql(
    '{ getProjectByName(name: "playground") { gradientStartColor gradientEndColor } }'
)["getProjectByName"]
write_answer(f"start {project['gradientStartColor']}, end {project['gradientEndColor']}")
