#!/usr/bin/env python3
"""Labels on a dataset"""

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

labels = rest(f"/datasets/{dataset_id('save_prompt')}/labels")["data"]
write_answer("none" if not labels else ", ".join(label["name"] for label in labels))
