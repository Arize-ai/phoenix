#!/usr/bin/env python3
"""Assistant trace-recording setting"""

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

config = graphql("{ agentsConfig { allowLocalTraces allowRemoteExport } }")["agentsConfig"]
write_answer(
    f"{'yes' if config['allowRemoteExport'] else 'no'}; allowLocalTraces {config['allowLocalTraces']}, "
    f"allowRemoteExport {config['allowRemoteExport']}"
)
