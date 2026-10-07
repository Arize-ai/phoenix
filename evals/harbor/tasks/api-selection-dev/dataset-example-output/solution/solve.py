#!/usr/bin/env python3
"""Expected output of a routing example"""

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

examples = rest(f"/datasets/{dataset_id('github-support-triage-tool-routing')}/examples")
(example,) = [e for e in examples["data"]["examples"] if "acme/widget#2128" in e["input"]["ticket"]]
write_answer(f"{json.dumps(example['output'])} (scenario {example['metadata'].get('scenario')})")
