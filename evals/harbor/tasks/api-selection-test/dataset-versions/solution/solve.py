#!/usr/bin/env python3
"""Version count of a dataset"""

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

versions = rest_pages(f"/datasets/{dataset_id('PXI E2E Agent Tests')}/versions", limit=100)
write_answer(f"{len(versions)} versions")
