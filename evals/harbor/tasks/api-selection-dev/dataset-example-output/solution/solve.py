#!/usr/bin/env python3
"""Expected output of a routing example"""

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

examples = rest(
    f"/datasets/{get_dataset_id_from_name('github-support-triage-tool-routing')}/examples"
)
(example,) = [e for e in examples["data"]["examples"] if "acme/widget#2128" in e["input"]["ticket"]]
write_answer(f"{json.dumps(example['output'])} (scenario {example['metadata'].get('scenario')})")
