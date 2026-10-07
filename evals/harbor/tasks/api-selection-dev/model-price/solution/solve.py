#!/usr/bin/env python3
"""Token prices of a model"""

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

(model,) = [m for m in generative_models() if m["name"] == "gpt-5.6-sol"]
write_answer(
    "; ".join(
        f"{p['tokenType']} ({p['kind']}): ${p['costPerMillionTokens']:g} per million"
        for p in sorted(model["tokenPrices"], key=lambda p: p["tokenType"])
    )
)
