#!/usr/bin/env python3
"""Template format and opening of a prompt"""

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

version = rest("/prompts/banking/latest")["data"]
first = version["template"]["messages"][0]
text = first["content"][0]["text"] if isinstance(first["content"], list) else first["content"]
write_answer(
    f"{version['template_format']}, a {version['template_type']} template; it begins {text[:200]!r}"
)
