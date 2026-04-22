"""End-to-end test of RedactedString on a live Phoenix server.

Complements the in-process unit test at
`tests/unit/server/api/mutations/test_generative_model_custom_provider_mutations.py`
by exercising the full HTTP stack (subprocess server, real middleware ordering,
real network) against a server with auth enabled and a random PHOENIX_SECRET.
"""

from __future__ import annotations

from secrets import token_hex

from phoenix.server.redaction import Redactor
from tests.integration._helpers import _AppInfo, _gql

_REDACTED_PREFIX = "\ue000[REDACTED]"


_CREATE_MUTATION = """
mutation Create($input: CreateGenerativeModelCustomProviderMutationInput!) {
    createGenerativeModelCustomProvider(input: $input) {
        provider { id }
    }
}
"""

_PATCH_MUTATION = """
mutation Patch($input: PatchGenerativeModelCustomProviderMutationInput!) {
    patchGenerativeModelCustomProvider(input: $input) {
        provider { id }
    }
}
"""

_DELETE_MUTATION = """
mutation Delete($input: DeleteGenerativeModelCustomProviderMutationInput!) {
    deleteGenerativeModelCustomProvider(input: $input) { id }
}
"""

_READ_QUERY = """
query Read($id: ID!) {
    node(id: $id) {
        ... on GenerativeModelCustomProvider {
            config {
                ... on OpenAICustomProviderConfig {
                    openaiAuthenticationMethod { apiKey }
                    openaiClientKwargs { baseUrl }
                }
            }
        }
    }
}
"""


def test_redacted_apikey_round_trips_through_live_server(
    _app: _AppInfo, _redactor: Redactor
) -> None:
    secret = token_hex(16)

    # Create with a client-redacted apiKey — server must un-redact on input.
    created, _ = _gql(
        _app,
        _app.admin_secret,
        query=_CREATE_MUTATION,
        variables={
            "input": {
                "name": f"test-redact-integration-{token_hex(4)}",
                "provider": "openai",
                "clientConfig": {
                    "openai": {
                        "openaiAuthenticationMethod": {"apiKey": _redactor.redact(secret)},
                        "openaiClientKwargs": {"baseUrl": "https://before.example.com"},
                    }
                },
            }
        },
    )
    provider_id = created["data"]["createGenerativeModelCustomProvider"]["provider"]["id"]

    try:
        # Read back — apiKey must be redacted and un-redact to `secret`.
        first, _ = _gql(_app, _app.admin_secret, query=_READ_QUERY, variables={"id": provider_id})
        first_token = first["data"]["node"]["config"]["openaiAuthenticationMethod"]["apiKey"]
        assert first_token.startswith(_REDACTED_PREFIX)
        assert _redactor.unredact(first_token) == secret

        # Echo the server-emitted redacted token back on patch while changing
        # an unrelated field. Server must still un-redact on input.
        _gql(
            _app,
            _app.admin_secret,
            query=_PATCH_MUTATION,
            variables={
                "input": {
                    "id": provider_id,
                    "clientConfig": {
                        "openai": {
                            "openaiAuthenticationMethod": {"apiKey": first_token},
                            "openaiClientKwargs": {"baseUrl": "https://after.example.com"},
                        }
                    },
                }
            },
        )

        second, _ = _gql(_app, _app.admin_secret, query=_READ_QUERY, variables={"id": provider_id})
        second_config = second["data"]["node"]["config"]
        assert second_config["openaiClientKwargs"]["baseUrl"] == "https://after.example.com"
        second_token = second_config["openaiAuthenticationMethod"]["apiKey"]
        # Stored secret must still be the ORIGINAL plaintext, not the redacted
        # token string.
        assert _redactor.unredact(second_token) == secret
        # Sanity: Fernet uses a random IV, so the assertion above isn't satisfied
        # by the server re-emitting the same blob.
        assert second_token != first_token
    finally:
        _gql(
            _app,
            _app.admin_secret,
            query=_DELETE_MUTATION,
            variables={"input": {"id": provider_id}},
        )
