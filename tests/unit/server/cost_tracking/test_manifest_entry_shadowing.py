"""
A manifest entry is shadowed when another entry's unanchored ``name_pattern`` wins the lookup
for a span that reports the shadowed entry's own model ID, so the span bills at the other
entry's rates (Arize-ai/phoenix#16402, #17652). These tests shadow one entry in a copy of the
bundled manifest and check that the manifest tests notice.
"""

import copy
import json
import re
from datetime import datetime, timezone
from typing import Any

import pytest

from phoenix.db import models
from phoenix.server.cost_tracking.cost_model_lookup import CostModelLookup
from phoenix.server.cost_tracking.manifest import BUNDLED_MANIFEST_PATH
from tests.unit.server.cost_tracking import test_model_cost_manifest as manifest_tests

SHADOWED = "gpt-4o-mini"
SHADOWING = "gpt-4o"


def _lookup(manifest: dict[str, Any]) -> CostModelLookup:
    now = datetime.now(timezone.utc)
    return CostModelLookup(
        models.GenerativeModel(
            id=index,
            name=model["name"],
            provider=model.get("provider") or "",
            start_time=None,
            name_pattern=re.compile(model["name_pattern"]),
            is_built_in=True,
            created_at=now,
            updated_at=now,
        )
        for index, model in enumerate(manifest["models"], start=1)
    )


def _resolve(lookup: CostModelLookup, model_name: str) -> str | None:
    model = lookup.find_model(
        start_time=datetime.now(timezone.utc),
        attributes={"llm": {"model_name": model_name}},
    )
    return model.name if model else None


@pytest.fixture(scope="module")
def shadowed_manifest() -> dict[str, Any]:
    manifest: dict[str, Any] = copy.deepcopy(json.loads(BUNDLED_MANIFEST_PATH.read_text()))
    entry = next(model for model in manifest["models"] if model["name"] == SHADOWED)
    # A weaker pattern for gpt-4o-mini: it still matches its own ID, but it is now less
    # specific than gpt-4o's unanchored pattern, which also matches gpt-4o-mini.
    entry["name_pattern"] = "o-mini"
    return manifest


def test_a_shadowed_entry_bills_as_the_entry_that_shadows_it(
    shadowed_manifest: dict[str, Any],
) -> None:
    assert _resolve(_lookup(json.loads(BUNDLED_MANIFEST_PATH.read_text())), SHADOWED) == SHADOWED
    assert _resolve(_lookup(shadowed_manifest), SHADOWED) == SHADOWING


def test_manifest_tests_catch_a_shadowed_entry(shadowed_manifest: dict[str, Any]) -> None:
    every_entry_test = getattr(
        manifest_tests, "test_every_manifest_entry_resolves_to_its_own_entry", None
    )
    assert every_entry_test is not None, (
        f"test_model_cost_manifest.py has no test that checks every manifest entry, so a "
        f"manifest in which {SHADOWED} bills as {SHADOWING} passes it"
    )
    entry = next(model for model in shadowed_manifest["models"] if model["name"] == SHADOWED)
    with pytest.raises(AssertionError):
        every_entry_test(built_in_lookup=_lookup(shadowed_manifest), entry=entry)
