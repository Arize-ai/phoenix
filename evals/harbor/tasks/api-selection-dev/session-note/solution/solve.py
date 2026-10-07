#!/usr/bin/env python3
"""Note on a session"""

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

notes = rest_pages(
    "/projects/mobile-review-queue/session_annotations",
    session_ids="fresh-unreviewed-session-x",
    include_annotation_names="note",
    limit=100,
)
write_answer(" | ".join(str(a["result"]["explanation"]) for a in notes))
