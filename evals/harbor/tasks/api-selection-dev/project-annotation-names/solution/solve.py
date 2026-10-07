#!/usr/bin/env python3
"""Span annotation names in a project"""

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

names = graphql(
    '{ getProjectByName(name: "openinference-tanstack-ai-verify-20260521") { spanAnnotationNames } }'
)["getProjectByName"]["spanAnnotationNames"]
write_answer(", ".join(sorted(names)))
