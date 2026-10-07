#!/usr/bin/env python3
"""Users and their roles"""

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

users = rest_pages("/users", limit=100)
write_answer(
    "; ".join(
        f"{u['username']} has role {u['role']}" for u in sorted(users, key=lambda u: rowid(u["id"]))
    )
    + "; authentication: "
    + ", ".join(sorted({u["auth_method"].lower() for u in users}))
)
