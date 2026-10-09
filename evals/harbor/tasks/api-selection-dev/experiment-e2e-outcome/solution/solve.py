#!/usr/bin/env python3
"""Judge verdict on an end-to-end experiment run"""

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

experiment = get_experiment_by_name(
    "PXI E2E Agent Tests", "pxi-e2e-docs-smoke-2026-05-04T14-34-34-020Z"
)
(run,) = get_experiment_runs(experiment["id"])
write_answer(
    "; ".join(
        f"{a.node.name} {a.node.label} ({a.node.score:g}): {a.node.explanation}"
        for a in run.annotations.edges
    )
)
