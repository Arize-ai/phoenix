import json
from hashlib import sha256
from pathlib import Path
from typing import Any, cast

import pytest

from scripts.datagen.fake_tools import (
    DEFAULT_REGISTRY,
    FAILURE_DELAY,
    FAILURE_EXCEPTION,
    InjectedToolFailure,
    InvocationLedger,
    ToolArgumentError,
    ToolContext,
    ToolError,
    ToolLoopLimitExceeded,
    load_default_fixture_sets,
)
from scripts.datagen.profile import ToolPatchOperation, ToolResultOverlay


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
    schemas = cast(list[dict[str, Any]], DEFAULT_REGISTRY.model_schemas())
    assert {schema["function"]["name"] for schema in schemas} == {
        "document_search",
        "record_lookup",
        "safe_arithmetic",
        "status_lookup",
        "ticket_creation",
    }
    assert all(
        schema["function"]["parameters"]["additionalProperties"] is False for schema in schemas
    )


def test_registry_validates_arguments_and_injects_only_declared_failures() -> None:
    fixtures = load_default_fixture_sets()["travel"]
    cell_id = sha256(b"cell-2").hexdigest()
    ledger = InvocationLedger()

    with pytest.raises(ToolArgumentError, match="must be a string"):
        DEFAULT_REGISTRY.invoke(
            "safe_arithmetic",
            {"expression": 3},
            ToolContext(pass_seed=4, cell_id=cell_id, fixture_set=fixtures),
            ledger,
        )
    with pytest.raises(ToolArgumentError, match="only numeric literals"):
        DEFAULT_REGISTRY.invoke(
            "safe_arithmetic",
            {"expression": "__import__('os').getcwd()"},
            ToolContext(pass_seed=4, cell_id=cell_id, fixture_set=fixtures),
            ledger,
        )

    delayed = DEFAULT_REGISTRY.invoke(
        "status_lookup",
        {"status_id": "trip-2001"},
        ToolContext(
            pass_seed=4,
            cell_id=cell_id,
            fixture_set=fixtures,
            failure_mode=FAILURE_DELAY,
            call_ordinal=6,
        ),
        ledger,
    )
    assert delayed["found"] is True
    assert 50 <= ledger.records[-1].declared_delay_ms <= 500
    with pytest.raises(InjectedToolFailure, match="injected failure"):
        DEFAULT_REGISTRY.invoke(
            "ticket_creation",
            {"title": "Missed connection", "description": "Rebook traveler", "priority": "high"},
            ToolContext(
                pass_seed=4,
                cell_id=cell_id,
                fixture_set=fixtures,
                failure_mode=FAILURE_EXCEPTION,
                call_ordinal=2,
            ),
            ledger,
        )
    assert ledger.records[-1].outcome == "error"
    assert ledger.records[-1].error is not None
    with pytest.raises(ToolLoopLimitExceeded, match="six-step limit"):
        ToolContext(pass_seed=4, cell_id=cell_id, fixture_set=fixtures, call_ordinal=7)


def test_registry_applies_matching_overlays_before_ledger_persistence() -> None:
    fixtures = load_default_fixture_sets()["travel"]
    cell_id = sha256(b"cell-overlay").hexdigest()
    overlay = ToolResultOverlay(
        tool_name="status_lookup",
        match_arguments={"status_id": "trip-2001"},
        operations=(
            ToolPatchOperation("replace", "/status/state", "pending review"),
            ToolPatchOperation("add", "/status/note", "Confirmation is being reconciled."),
        ),
    )
    ledger = InvocationLedger()

    result = DEFAULT_REGISTRY.invoke(
        "status_lookup",
        {"status_id": "trip-2001"},
        ToolContext(
            pass_seed=9,
            cell_id=cell_id,
            fixture_set=fixtures,
            result_overlays=(overlay,),
        ),
        ledger,
    )

    status = cast(dict[str, Any], result["status"])
    assert status["state"] == "pending review"
    assert status["note"] == "Confirmation is being reconciled."
    assert ledger.records[-1].result == result
    assert result["invocation_id"] == ledger.records[-1].invocation_id

    unmatched = DEFAULT_REGISTRY.invoke(
        "status_lookup",
        {"status_id": "trip-2002"},
        ToolContext(
            pass_seed=9,
            cell_id=cell_id,
            fixture_set=fixtures,
            result_overlays=(overlay,),
            call_ordinal=2,
        ),
        InvocationLedger(),
    )
    unmatched_status = cast(dict[str, Any], unmatched["status"])
    assert unmatched_status["state"] == "delayed"


def test_registry_rejects_overlays_that_change_invocation_identity() -> None:
    fixtures = load_default_fixture_sets()["travel"]
    overlay = ToolResultOverlay(
        tool_name="status_lookup",
        match_arguments={},
        operations=(ToolPatchOperation("replace", "/invocation_id", "other"),),
    )

    with pytest.raises(ToolError, match="invocation_id"):
        DEFAULT_REGISTRY.invoke(
            "status_lookup",
            {"status_id": "trip-2001"},
            ToolContext(
                pass_seed=9,
                cell_id=sha256(b"cell-overlay-id").hexdigest(),
                fixture_set=fixtures,
                result_overlays=(overlay,),
            ),
            InvocationLedger(),
        )
