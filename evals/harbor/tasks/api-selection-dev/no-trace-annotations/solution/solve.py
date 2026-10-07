#!/usr/bin/env python3
"""A project without trace annotations"""

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
    '{ getProjectByName(name: "mobile-review-queue") { traceAnnotationNames sessionAnnotationNames spanAnnotationNames } }'
)["getProjectByName"]
write_answer(
    ("none" if not project["traceAnnotationNames"] else ", ".join(project["traceAnnotationNames"]))
    + f"; session annotations: {', '.join(project['sessionAnnotationNames']) or 'none'}; "
    f"span annotations: {', '.join(project['spanAnnotationNames']) or 'none'}"
)
