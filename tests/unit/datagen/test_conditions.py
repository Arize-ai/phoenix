import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any, cast

from scripts.datagen.conditions import materialize_condition
from scripts.datagen.fake_tools import load_fixture_sets, local_tools
from scripts.datagen.recording import RecorderFixture


def test_condition_materialization_selects_strength_and_isolates_inputs(tmp_path: Path) -> None:
    conditions_path = tmp_path / "conditions.json"
    conditions_path.write_text(json.dumps([_condition(0.5)]), encoding="utf-8")
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
    assert conditioned.fixture.inputs["prompt"] == "Check the strong policy and order status."
    input_documents = cast(list[dict[str, Any]], conditioned.fixture.inputs["documents"])
    assert input_documents[0]["text"] == "Returns close after 14 days."
    assert conditioned.tool_fixture_set is not None
    assert _document_text(conditioned.tool_fixture_set, "delivery-guide").endswith(
        " Evidence age: 14 days."
    )
    tools = local_tools(
        "customer_support",
        fixture_set=conditioned.tool_fixture_set,
        result_overlays=conditioned.tool_result_overlays,
    )
    assert tools.invoke("status_lookup", {"status_id": "order-1001"}) == {
        "found": True,
        "status": {"id": "order-1001", "state": "strong", "note": "14"},
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
    assert second_documents[0]["text"] == "Returns close after 14 days."
    assert cast(list[dict[str, Any]], base_fixture.inputs["documents"])[0]["text"] == (
        "Returns close after 30 days."
    )
    assert _document_text(fixture_sets["customer_support"], "delivery-guide") == (
        base_delivery_text
    )


def _condition(intensity: float) -> dict[str, Any]:
    strengths = {}
    for strength, days in (("subtle", "29"), ("moderate", "21"), ("strong", "14")):
        strengths[strength] = {
            "input_replacements": [
                {
                    "path": "/prompt",
                    "value": f"Check the {strength} policy and order status.",
                }
            ],
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
