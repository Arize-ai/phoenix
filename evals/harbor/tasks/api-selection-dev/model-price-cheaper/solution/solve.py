#!/usr/bin/env python3
"""Compare two models' input prices"""

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

prices = {}
for model in generative_models():
    if model["name"] in ("gpt-5.6-luna", "gpt-4o-mini"):
        (price,) = [p for p in model["tokenPrices"] if p["tokenType"] == "input"]
        prices[model["name"]] = price["costPerMillionTokens"]
cheaper = prices["gpt-5.6-luna"] < prices["gpt-4o-mini"]
write_answer(
    f"{'yes' if cheaper else 'no'}: gpt-5.6-luna costs ${prices['gpt-5.6-luna']:g} per million input tokens "
    f"and gpt-4o-mini ${prices['gpt-4o-mini']:g}"
)
