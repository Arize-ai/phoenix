#!/usr/bin/env python3
"""Span annotation names in a project"""

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

names = graphql(
    '{ getProjectByName(name: "openinference-tanstack-ai-verify-20260521") { spanAnnotationNames } }'
)["getProjectByName"]["spanAnnotationNames"]
write_answer(", ".join(sorted(names)))
