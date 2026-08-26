from scripts.datagen.fake_tools import local_tools


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
