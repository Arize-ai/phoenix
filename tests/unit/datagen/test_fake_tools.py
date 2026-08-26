from typing import Any, cast

from scripts.datagen.fake_tools import ToolPatchOperation, ToolResultOverlay, local_tools


def test_local_tools_use_domain_fixture_data() -> None:
    tools = local_tools("customer_support")

    search = tools.invoke("document_search", {"query": "standard delivery", "limit": 1})
    calculation = tools.invoke("safe_arithmetic", {"expression": "42.25 * 2"})

    assert isinstance(search, dict)
    documents = search.get("documents")
    assert isinstance(documents, list)
    assert documents
    first_document = documents[0]
    assert isinstance(first_document, dict)
    assert first_document["id"] == "delivery-guide"
    assert calculation == {"expression": "42.25 * 2", "result": 84.5}
    names = set()
    for schema in tools.schemas:
        assert isinstance(schema, dict)
        function = schema.get("function")
        assert isinstance(function, dict)
        name = function.get("name")
        assert isinstance(name, str)
        names.add(name)
    assert names == {
        "document_search",
        "record_lookup",
        "safe_arithmetic",
        "status_lookup",
        "ticket_creation",
    }


def test_local_tools_apply_argument_matched_json_pointer_operations() -> None:
    overlay = ToolResultOverlay(
        "document_search",
        {"query": "standard delivery"},
        (
            ToolPatchOperation("replace", "/documents/0/title", "Provisional guidance"),
            ToolPatchOperation("add", "/documents/0/note", "Verify with support."),
            ToolPatchOperation("remove", "/documents/0/text"),
        ),
    )
    tools = local_tools("customer_support", result_overlays=(overlay,))

    matched = tools.invoke("document_search", {"query": "standard delivery", "limit": 1})
    matched_documents = cast(list[dict[str, Any]], matched["documents"])
    assert matched_documents == [
        {
            "id": "delivery-guide",
            "title": "Provisional guidance",
            "note": "Verify with support.",
        }
    ]
    unmatched = tools.invoke("document_search", {"query": "returns", "limit": 1})
    unmatched_documents = cast(list[dict[str, Any]], unmatched["documents"])
    assert "text" in unmatched_documents[0]
