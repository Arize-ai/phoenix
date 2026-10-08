#!/usr/bin/env python3
"""Assistant trace-recording setting"""

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

config = graphql("{ agentsConfig { allowLocalTraces allowRemoteExport } }")["agentsConfig"]
write_answer(
    f"{'yes' if config['allowRemoteExport'] else 'no'}; allowLocalTraces {config['allowLocalTraces']}, "
    f"allowRemoteExport {config['allowRemoteExport']}"
)
