from scripts.datagen.fake_tools import local_tools


def test_local_tools_use_domain_fixture_data() -> None:
    tools = local_tools("customer_support")

    search = tools.invoke("document_search", {"query": "standard delivery", "limit": 1})
    calculation = tools.invoke("safe_arithmetic", {"expression": "42.25 * 2"})

    assert search["documents"][0]["id"] == "delivery-guide"
    assert calculation == {"expression": "42.25 * 2", "result": 84.5}
    assert {schema["function"]["name"] for schema in tools.schemas} == {
        "document_search",
        "record_lookup",
        "safe_arithmetic",
        "status_lookup",
        "ticket_creation",
    }
