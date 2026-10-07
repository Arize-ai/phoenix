#!/usr/bin/env python3
"""Error every run of an experiment hit"""

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
    "github-support-triage-tool-routing", "Luna first-tool routing baseline"
)
runs = rest_pages(f"/experiments/{experiment['id']}/runs", limit=100)
errors = Counter(str(r["error"])[:120] for r in runs if r["error"])
write_answer(
    f"{sum(errors.values())} of {len(runs)} runs errored: "
    + "; ".join(f"{n} x {e!r}" for e, n in errors.most_common())
)
