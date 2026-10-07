#!/usr/bin/env python3
"""Judge verdict on an end-to-end experiment run"""

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

experiment = experiment_by_name(
    "PXI E2E Agent Tests", "pxi-e2e-docs-smoke-2026-05-04T14-34-34-020Z"
)
(run,) = experiment_runs(experiment["id"])
write_answer(
    "; ".join(
        f"{a['name']} {a['label']} ({a['score']:g}): {a['explanation']}" for a in run["annotations"]
    )
)
