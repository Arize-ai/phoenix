import json
from hashlib import sha256
from pathlib import Path
from typing import Any, cast

from scripts.datagen.fake_tools import (
    DEFAULT_REGISTRY,
    InvocationLedger,
    ToolContext,
    load_default_fixture_sets,
)


def test_registry_is_deterministic_and_writes_replayable_ledger(tmp_path: Path) -> None:
    fixtures = load_default_fixture_sets()["retail"]
    cell_id = sha256(b"cell-1").hexdigest()
    arguments = {"query": "standard delivery", "limit": 2}

    first_ledger = InvocationLedger(tmp_path / "first.jsonl")
    first = DEFAULT_REGISTRY.invoke(
        "document_search",
        arguments,
        ToolContext(pass_seed=17, cell_id=cell_id, fixture_set=fixtures),
        first_ledger,
    )
    second_ledger = InvocationLedger(tmp_path / "second.jsonl")
    second = DEFAULT_REGISTRY.invoke(
        "document_search",
        arguments,
        ToolContext(pass_seed=17, cell_id=cell_id, fixture_set=fixtures),
        second_ledger,
    )

    assert first == second
    documents = cast(list[dict[str, Any]], first["documents"])
    assert documents[0]["id"] == "doc-shipping"
    assert first_ledger.records == second_ledger.records
    assert json.loads((tmp_path / "first.jsonl").read_text()) == first_ledger.records[0].to_dict()
