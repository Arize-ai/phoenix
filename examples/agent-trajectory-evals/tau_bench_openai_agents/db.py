"""
In-memory database loader for tau-bench retail domain.

Loads users, orders, and products from tau-bench's JSON data files.
Each call to load_data() returns a fresh copy, so tests can mutate
state without affecting each other.
"""

import copy
import json
import os
from typing import Any

# Path to tau-bench retail data files
_DATA_DIR = os.path.join(
    os.path.dirname(__file__),
    "..",
    "vendor",
    "tau-bench",
    "tau_bench",
    "envs",
    "retail",
    "data",
)


def _load_json(filename: str) -> Any:
    with open(os.path.join(_DATA_DIR, filename)) as f:
        return json.load(f)


# Cache the raw data on first load to avoid re-reading files
_CACHED_DATA: dict[str, Any] | None = None


def _get_cached_data() -> dict[str, Any]:
    global _CACHED_DATA
    if _CACHED_DATA is None:
        _CACHED_DATA = {
            "orders": _load_json("orders.json"),
            "products": _load_json("products.json"),
            "users": _load_json("users.json"),
        }
    return _CACHED_DATA


def load_data() -> dict[str, Any]:
    """Load a fresh (deep-copied) retail database.

    Returns a dict with keys: "orders", "products", "users".
    Each call returns an independent copy that can be mutated freely.
    """
    return copy.deepcopy(_get_cached_data())
