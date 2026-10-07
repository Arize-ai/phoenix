#!/usr/bin/env python3
"""Sandbox providers and configs"""

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

providers = graphql(
    "{ sandboxProviders { backendType enabled configs { name language timeout } } }"
)["sandboxProviders"]
enabled = [p["backendType"] for p in providers if p["enabled"]]
configs = [
    (c["name"], p["backendType"], c["language"], c["timeout"])
    for p in providers
    for c in p["configs"]
]
write_answer(
    f"{len(enabled)} of {len(providers)} providers enabled ({', '.join(enabled)}); {len(configs)} configs: "
    + ", ".join(f"{n} ({b}, {lang}, {t} s)" for n, b, lang, t in sorted(configs))
)
