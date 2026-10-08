#!/usr/bin/env python3
"""Project name and trace count for a Phoenix id"""

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
    "query($id: ID!) { node(id: $id) { ... on Project { name traceCount } } }",
    {"id": "UHJvamVjdDoz"},
)["node"]
write_answer(f"{project['name']} with {project['traceCount']} traces")
