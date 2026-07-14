import httpx
import pytest

# The unit-test app is built with `authentication_enabled=False`, which is precisely the
# configuration in which these endpoints must refuse to act: without authentication Phoenix
# has no notion of identity, so minting an API key would hand out a durable credential to an
# anonymous caller. Every route must fail closed with a 403.
_API_KEY_ROUTES = [
    ("GET", "v1/user/api_keys"),
    ("POST", "v1/user/api_keys"),
    ("DELETE", "v1/user/api_keys/fake-id"),
    ("GET", "v1/system/api_keys"),
    ("POST", "v1/system/api_keys"),
    ("DELETE", "v1/system/api_keys/fake-id"),
]


@pytest.mark.parametrize("method,url", _API_KEY_ROUTES)
async def test_api_keys_are_forbidden_when_auth_is_disabled(
    method: str,
    url: str,
    httpx_client: httpx.AsyncClient,
) -> None:
    response = await httpx_client.request(
        method, url, json={"data": {"name": "should-not-be-created"}}
    )
    assert response.status_code == 403
    assert "authentication" in response.text.lower()
