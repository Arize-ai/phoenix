#!/usr/bin/env python3
"""Users and their roles"""

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

users = rest_pages("/users", limit=100)
write_answer(
    "; ".join(
        f"{u['username']} has role {u['role']}" for u in sorted(users, key=lambda u: rowid(u["id"]))
    )
    + "; authentication: "
    + ", ".join(sorted({u["auth_method"].lower() for u in users}))
)
