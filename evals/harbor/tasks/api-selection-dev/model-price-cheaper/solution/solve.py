#!/usr/bin/env python3
"""Compare two models' input prices"""

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

prices = {}
for model in get_generative_models():
    if model.name in ("gpt-5.6-luna", "gpt-4o-mini"):
        (price,) = [p for p in model.token_prices if p.token_type == "input"]
        prices[model.name] = price.cost_per_million_tokens
cheaper = prices["gpt-5.6-luna"] < prices["gpt-4o-mini"]
write_answer(
    f"{'yes' if cheaper else 'no'}: gpt-5.6-luna costs ${prices['gpt-5.6-luna']:g} per million input tokens "
    f"and gpt-4o-mini ${prices['gpt-4o-mini']:g}"
)
