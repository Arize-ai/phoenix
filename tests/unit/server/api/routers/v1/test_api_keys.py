import httpx
import pytest
from strawberry.relay import GlobalID

from tests.unit.graphql import AsyncGraphQLClient

# The unit-test app is built with `authentication_enabled=False`, which is precisely the
# configuration in which these endpoints must refuse to act: without authentication Phoenix
# has no notion of identity, so minting an API key would hand out a durable credential to an
# anonymous caller. Every route must fail closed with a 403.
_API_KEY_ROUTES = [
    ("GET", "v1/user/api_keys"),
    ("GET", "v1/users/api_keys"),
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


@pytest.mark.parametrize(
    "mutation",
    [
        'mutation { createUserApiKey(input: {name: "forbidden"}) { jwt } }',
        (
            "mutation { deleteUserApiKey(input: {id: "
            f'"{GlobalID("UserApiKey", "1")}"'
            "}) { apiKeyId } }"
        ),
    ],
)
async def test_graphql_personal_api_key_mutations_are_forbidden_when_auth_is_disabled(
    mutation: str,
    gql_client: AsyncGraphQLClient,
) -> None:
    response = await gql_client.execute(query=mutation)
    assert response.data is None
    assert response.errors
    assert response.errors[0].message == "Authentication must be enabled to manage API keys"
