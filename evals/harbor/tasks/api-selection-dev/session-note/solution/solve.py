#!/usr/bin/env python3
"""Note on a session"""

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

notes = rest_pages(
    "/projects/mobile-review-queue/session_annotations",
    session_ids="fresh-unreviewed-session-x",
    include_annotation_names="note",
    limit=100,
)
write_answer(" | ".join(str(a["result"]["explanation"]) for a in notes))
