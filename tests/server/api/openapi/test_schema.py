from phoenix.server.api.openapi.schema import get_openapi_schema


def test_get_openapi_schema(pydantic_version) -> None:
    assert pydantic_version == "v1"
    # ensures schema can be generated on both pydantic v1 and v2
    assert isinstance(get_openapi_schema(), dict)
