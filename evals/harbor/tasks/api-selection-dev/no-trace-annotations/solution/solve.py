#!/usr/bin/env python3
"""A project without trace annotations"""

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
    '{ getProjectByName(name: "mobile-review-queue") { traceAnnotationNames sessionAnnotationNames spanAnnotationNames } }'
)["getProjectByName"]
write_answer(
    ("none" if not project["traceAnnotationNames"] else ", ".join(project["traceAnnotationNames"]))
    + f"; session annotations: {', '.join(project['sessionAnnotationNames']) or 'none'}; "
    f"span annotations: {', '.join(project['spanAnnotationNames']) or 'none'}"
)
