#!/usr/bin/env python3
"""Prompt version carrying a tag"""

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

prompts = rest_pages("/prompts", limit=100)
hits = []
for prompt in prompts:
    version = rest(f"/prompts/{prompt['id']}/tags/staging", missing_ok=True)
    if version:
        tags = rest_pages(f"/prompt_versions/{version['data']['id']}/tags", limit=100)
        (tag,) = [t for t in tags if t["name"] == "staging"]
        hits.append(
            f"version {version['data']['id']} of {prompt['name']} ({tag.get('description')!r})"
        )
write_answer("; ".join(hits) or "no version carries the staging tag")
