import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any, cast

import pytest

from scripts.datagen.conditions import ConditionError, materialize_condition
from scripts.datagen.fake_tools import load_fixture_sets, local_tools
from scripts.datagen.recording import RecorderFixture


@pytest.mark.parametrize(
    ("intensity", "expected_days", "expected_state"),
    [
        (0.199999, "29", "subtle"),
        (0.2, "21", "moderate"),
        (0.5, "14", "strong"),
    ],
)
def test_condition_materialization_selects_strength_and_isolates_inputs(
    tmp_path: Path,
    intensity: float,
    expected_days: str,
    expected_state: str,
) -> None:
    conditions_path = tmp_path / "conditions.json"
    conditions_path.write_text(json.dumps([_condition(intensity)]), encoding="utf-8")
    base_fixture = RecorderFixture(
        fragment_id="base-tool-fixture",
        archetype="tool_agent",
        domain="customer_support",
        inputs={
            "prompt": "Check the policy and order status.",
            "documents": [{"source": "return-policy", "text": "Returns close after 30 days."}],
        },
    )
    fixture_sets = load_fixture_sets()
    base_delivery_text = _document_text(fixture_sets["customer_support"], "delivery-guide")

    conditioned = materialize_condition(
        "boundary-condition",
        conditions_path,
        fixtures=(base_fixture,),
        fixture_sets=fixture_sets,
    )

    assert conditioned.fixture.fragment_id == "conditioned-tool-fragment"
    input_documents = cast(list[dict[str, Any]], conditioned.fixture.inputs["documents"])
    assert input_documents[0]["text"] == f"Returns close after {expected_days} days."
    assert conditioned.tool_fixture_set is not None
    assert _document_text(conditioned.tool_fixture_set, "delivery-guide").endswith(
        f" Evidence age: {expected_days} days."
    )
    tools = local_tools(
        "customer_support",
        fixture_set=conditioned.tool_fixture_set,
        result_overlays=conditioned.tool_result_overlays,
    )
    result = tools.invoke("status_lookup", {"status_id": "order-1001"})
    assert result == {
        "found": True,
        "status": {"id": "order-1001", "state": expected_state, "note": expected_days},
        "conditioned": True,
    }
    assert tools.invoke("status_lookup", {"status_id": "order-1002"}) == {
        "found": True,
        "status": {
            "id": "order-1002",
            "state": "processing",
            "detail": "Preparing for shipment",
        },
        "conditioned": True,
    }

    input_documents[0]["text"] = "changed after materialization"
    second = materialize_condition(
        "boundary-condition",
        conditions_path,
        fixtures=(base_fixture,),
        fixture_sets=fixture_sets,
    )
    second_documents = cast(list[dict[str, Any]], second.fixture.inputs["documents"])
    assert second_documents[0]["text"] == f"Returns close after {expected_days} days."
    assert cast(list[dict[str, Any]], base_fixture.inputs["documents"])[0]["text"] == (
        "Returns close after 30 days."
    )
    assert _document_text(fixture_sets["customer_support"], "delivery-guide") == (
        base_delivery_text
    )


@pytest.mark.parametrize(
    ("operations", "message"),
    [
        (
            [
                {"operation": "replace", "path": "/status/state", "value": "first"},
                {"operation": "remove", "path": "/status/state"},
            ],
            "collide",
        ),
        (
            [{"operation": "replace", "path": "/status/missing", "value": "value"}],
            "does not exist",
        ),
        (
            [{"operation": "add", "path": "/missing/value", "value": "value"}],
            "does not exist",
        ),
    ],
)
def test_condition_materialization_rejects_invalid_tool_paths(
    tmp_path: Path,
    operations: list[dict[str, Any]],
    message: str,
) -> None:
    condition = _condition(0.2)
    strengths = cast(dict[str, Any], condition["strengths"])
    moderate = cast(dict[str, Any], strengths["moderate"])
    overlay = cast(list[dict[str, Any]], moderate["tool_overlays"])[0]
    overlay["operations"] = operations
    path = tmp_path / "conditions.json"
    path.write_text(json.dumps([condition]), encoding="utf-8")
    fixture = RecorderFixture(
        "base-tool-fixture",
        "tool_agent",
        "customer_support",
        {"prompt": "Check status.", "documents": [{"source": "return-policy", "text": "30"}]},
    )

    with pytest.raises(ConditionError, match=message):
        materialize_condition("boundary-condition", path, fixtures=(fixture,))


def test_repository_condition_file_materializes() -> None:
    conditioned = materialize_condition("support-stale-delivery-status")

    assert conditioned.fixture.fragment_id == "support-order-and-status-tools-stale"
    assert conditioned.tool_fixture_set is not None
    result = local_tools(
        "customer_support",
        fixture_set=conditioned.tool_fixture_set,
        result_overlays=conditioned.tool_result_overlays,
    ).invoke("status_lookup", {"status_id": "order-1001"})
    assert result["status"] == {
        "id": "order-1001",
        "state": "exception_review",
        "detail": "Carrier scan unchanged for two business days",
        "note": "The carrier history is still being reconciled.",
    }


def _condition(intensity: float) -> dict[str, Any]:
    strengths = {}
    for strength, days in (("subtle", "29"), ("moderate", "21"), ("strong", "14")):
        strengths[strength] = {
            "document_edits": [
                {
                    "target": "fixture",
                    "document_id": "return-policy",
                    "operation": "replace_once",
                    "source": "30",
                    "replacement": days,
                },
                {
                    "target": "tool_corpus",
                    "document_id": "delivery-guide",
                    "operation": "append",
                    "text": f" Evidence age: {days} days.",
                },
            ],
            "tool_overlays": [
                {
                    "tool_name": "status_lookup",
                    "match_arguments": {"status_id": "order-1001"},
                    "operations": [
                        {
                            "operation": "replace",
                            "path": "/status/state",
                            "value": strength,
                        },
                        {"operation": "add", "path": "/status/note", "value": days},
                        {"operation": "remove", "path": "/status/detail"},
                    ],
                },
                {
                    "tool_name": "status_lookup",
                    "match_arguments": {},
                    "operations": [{"operation": "add", "path": "/conditioned", "value": True}],
                },
            ],
        }
    return {
        "condition_id": "boundary-condition",
        "fixture_id": "base-tool-fixture",
        "fragment_id": "conditioned-tool-fragment",
        "intensity": intensity,
        "strengths": strengths,
    }


def _document_text(fixture_set: Mapping[str, Any], document_id: str) -> str:
    documents = cast(Sequence[Mapping[str, Any]], fixture_set["documents"])
    return cast(str, next(item["text"] for item in documents if item["id"] == document_id))
