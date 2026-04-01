from __future__ import annotations

from collections.abc import Iterator
from secrets import token_hex
from typing import TYPE_CHECKING, Any, Callable

import httpx
import pytest

from phoenix.server.api.exceptions import Unauthorized

from .._helpers import (
    _ADMIN,
    _MEMBER,
    _VIEWER,
    _gql,
    _httpx_client,
)

if TYPE_CHECKING:
    from .._helpers import _AppInfo, _GetUser, _SecurityArtifact

_UNSET: Any = object()


@pytest.fixture()
def _secret_keys(_app: _AppInfo) -> Iterator[Callable[[str], str]]:
    """Register secret keys for automatic cleanup after each test."""
    keys: list[str] = []

    def _track(key: str) -> str:
        keys.append(key)
        return key

    yield _track
    for k in keys:
        _httpx_client(_app, _app.admin_secret).put(
            "v1/secrets", json={"secrets": [{"key": k, "value": None}]}
        )


SECRETS_QUERY = """
query SecretsQuery($keys: [String!]) {
    secrets(keys: $keys) {
        edges {
            node {
                key
                value {
                    ... on DecryptedSecret { value }
                }
            }
        }
    }
}
"""

UPSERT_OR_DELETE_MUTATION = """
mutation UpsertOrDeleteSecrets($input: UpsertOrDeleteSecretsMutationInput!) {
    upsertOrDeleteSecrets(input: $input) {
        upsertedSecrets {
            id
            key
            value {
                ... on DecryptedSecret { value }
            }
        }
        deletedIds
    }
}
"""


def _put_secrets(
    app: _AppInfo,
    secrets: list[dict[str, Any]],
    auth: _SecurityArtifact | None = _UNSET,
) -> httpx.Response:
    """PUT /v1/secrets and return the response.

    Pass ``auth=None`` to send the request without any credentials.
    Omit ``auth`` (or pass the sentinel default) to use ``app.admin_secret``.
    """
    effective_auth = app.admin_secret if auth is _UNSET else auth
    client = _httpx_client(app, effective_auth)
    return client.put("v1/secrets", json={"secrets": secrets})


def _query_secret_value(app: _AppInfo, key: str, auth: _SecurityArtifact | None = _UNSET) -> str:
    """Read a single secret's decrypted value via GraphQL."""
    effective_auth = app.admin_secret if auth is _UNSET else auth
    result, _ = _gql(app, effective_auth, query=SECRETS_QUERY, variables={"keys": [key]})
    assert not result.get("errors"), result.get("errors")
    edges = result["data"]["secrets"]["edges"]
    assert len(edges) == 1, f"Expected 1 secret, got {len(edges)}"
    value: str = edges[0]["node"]["value"]["value"]
    return value


def _assert_secret_absent(app: _AppInfo, key: str) -> None:
    """Verify a secret no longer exists via GraphQL."""
    result, _ = _gql(app, app.admin_secret, query=SECRETS_QUERY, variables={"keys": [key]})
    assert not result.get("errors"), result.get("errors")
    edges = result["data"]["secrets"]["edges"]
    assert len(edges) == 0, f"Expected secret '{key}' to be absent, got {len(edges)} result(s)"


class TestSecretsEncryptionRoundtrip:
    """E2E verification that secrets are encrypted at rest and correctly decrypted on read."""

    def test_rest_write_graphql_read_roundtrip(
        self, _app: _AppInfo, _secret_keys: Callable[[str], str]
    ) -> None:
        key = _secret_keys(f"E2E_REST_{token_hex(4)}")
        value = f"sk-test-{token_hex(16)}"
        resp = _put_secrets(_app, [{"key": key, "value": value}])
        assert resp.status_code == 200, resp.text
        assert _query_secret_value(_app, key) == value

    def test_graphql_mutation_write_graphql_query_read_roundtrip(
        self, _app: _AppInfo, _secret_keys: Callable[[str], str]
    ) -> None:
        key = _secret_keys(f"E2E_GQL_{token_hex(4)}")
        value = f"sk-ant-{token_hex(16)}"
        result, _ = _gql(
            _app,
            _app.admin_secret,
            query=UPSERT_OR_DELETE_MUTATION,
            variables={"input": {"secrets": [{"key": key, "value": value}]}},
            operation_name="UpsertOrDeleteSecrets",
        )
        assert not result.get("errors"), result.get("errors")
        upserted = result["data"]["upsertOrDeleteSecrets"]["upsertedSecrets"]
        assert len(upserted) == 1
        assert upserted[0]["key"] == key
        assert upserted[0]["value"]["value"] == value
        assert _query_secret_value(_app, key) == value

    def test_update_secret_roundtrip(
        self, _app: _AppInfo, _secret_keys: Callable[[str], str]
    ) -> None:
        key = _secret_keys(f"E2E_UPD_{token_hex(4)}")
        _put_secrets(_app, [{"key": key, "value": "original-value"}])
        _put_secrets(_app, [{"key": key, "value": "updated-value"}])
        assert _query_secret_value(_app, key) == "updated-value"


class TestSecretsCRUDViaREST:
    """CRUD operations through the REST PUT endpoint."""

    def test_upsert_single_secret(self, _app: _AppInfo, _secret_keys: Callable[[str], str]) -> None:
        key = _secret_keys(f"REST_UPSERT_{token_hex(4)}")
        resp = _put_secrets(_app, [{"key": key, "value": "val"}])
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["upserted_keys"] == [key]
        assert data["deleted_keys"] == []
        assert _query_secret_value(_app, key) == "val"

    def test_update_existing_secret(
        self, _app: _AppInfo, _secret_keys: Callable[[str], str]
    ) -> None:
        key = _secret_keys(f"REST_UPDATE_{token_hex(4)}")
        _put_secrets(_app, [{"key": key, "value": "v1"}])
        resp = _put_secrets(_app, [{"key": key, "value": "v2"}])
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["upserted_keys"] == [key]
        assert _query_secret_value(_app, key) == "v2"

    def test_delete_existing_secret(self, _app: _AppInfo) -> None:
        key = f"REST_DEL_{token_hex(4)}"
        _put_secrets(_app, [{"key": key, "value": "v"}])
        resp = _put_secrets(_app, [{"key": key, "value": None}])
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["upserted_keys"] == []
        assert data["deleted_keys"] == [key]
        _assert_secret_absent(_app, key)

    def test_delete_nonexistent_secret_is_idempotent(self, _app: _AppInfo) -> None:
        key = f"REST_NODEL_{token_hex(4)}"
        resp = _put_secrets(_app, [{"key": key, "value": None}])
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["deleted_keys"] == [key]

    def test_batch_upsert_and_delete(
        self, _app: _AppInfo, _secret_keys: Callable[[str], str]
    ) -> None:
        k1 = _secret_keys(f"REST_BATCH_{token_hex(4)}_0")
        k2 = _secret_keys(f"REST_BATCH_{token_hex(4)}_1")
        k_del = f"REST_BATCH_{token_hex(4)}_2"
        _put_secrets(_app, [{"key": k_del, "value": "v"}])
        resp = _put_secrets(
            _app,
            [
                {"key": k1, "value": "val1"},
                {"key": k2, "value": "val2"},
                {"key": k_del, "value": None},
            ],
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert set(data["upserted_keys"]) == {k1, k2}
        assert data["deleted_keys"] == [k_del]
        assert _query_secret_value(_app, k1) == "val1"
        assert _query_secret_value(_app, k2) == "val2"
        _assert_secret_absent(_app, k_del)

    def test_duplicate_keys_last_wins(
        self, _app: _AppInfo, _secret_keys: Callable[[str], str]
    ) -> None:
        key = _secret_keys(f"REST_DUP_{token_hex(4)}")
        resp = _put_secrets(
            _app,
            [
                {"key": key, "value": "first"},
                {"key": key, "value": "last"},
            ],
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["upserted_keys"] == [key]
        assert _query_secret_value(_app, key) == "last"


class TestSecretsCRUDViaGraphQL:
    """CRUD operations through the GraphQL mutation."""

    def test_create_secret(self, _app: _AppInfo, _secret_keys: Callable[[str], str]) -> None:
        key = _secret_keys(f"GQL_CREATE_{token_hex(4)}")
        value = "gql-value-123"
        result, _ = _gql(
            _app,
            _app.admin_secret,
            query=UPSERT_OR_DELETE_MUTATION,
            variables={"input": {"secrets": [{"key": key, "value": value}]}},
            operation_name="UpsertOrDeleteSecrets",
        )
        assert not result.get("errors"), result.get("errors")
        upserted = result["data"]["upsertOrDeleteSecrets"]["upsertedSecrets"]
        assert len(upserted) == 1
        assert upserted[0]["key"] == key
        assert upserted[0]["value"]["value"] == value
        assert _query_secret_value(_app, key) == value

    def test_update_secret(self, _app: _AppInfo, _secret_keys: Callable[[str], str]) -> None:
        key = _secret_keys(f"GQL_UPDATE_{token_hex(4)}")
        _gql(
            _app,
            _app.admin_secret,
            query=UPSERT_OR_DELETE_MUTATION,
            variables={"input": {"secrets": [{"key": key, "value": "old"}]}},
            operation_name="UpsertOrDeleteSecrets",
        )
        result, _ = _gql(
            _app,
            _app.admin_secret,
            query=UPSERT_OR_DELETE_MUTATION,
            variables={"input": {"secrets": [{"key": key, "value": "new"}]}},
            operation_name="UpsertOrDeleteSecrets",
        )
        assert not result.get("errors"), result.get("errors")
        upserted = result["data"]["upsertOrDeleteSecrets"]["upsertedSecrets"]
        assert upserted[0]["value"]["value"] == "new"
        assert _query_secret_value(_app, key) == "new"

    def test_delete_secret(self, _app: _AppInfo) -> None:
        key = f"GQL_DEL_{token_hex(4)}"
        _gql(
            _app,
            _app.admin_secret,
            query=UPSERT_OR_DELETE_MUTATION,
            variables={"input": {"secrets": [{"key": key, "value": "v"}]}},
            operation_name="UpsertOrDeleteSecrets",
        )
        result, _ = _gql(
            _app,
            _app.admin_secret,
            query=UPSERT_OR_DELETE_MUTATION,
            variables={"input": {"secrets": [{"key": key, "value": None}]}},
            operation_name="UpsertOrDeleteSecrets",
        )
        assert not result.get("errors"), result.get("errors")
        deleted = result["data"]["upsertOrDeleteSecrets"]["deletedIds"]
        assert len(deleted) == 1
        _assert_secret_absent(_app, key)

    def test_batch_operations(self, _app: _AppInfo, _secret_keys: Callable[[str], str]) -> None:
        k1 = _secret_keys(f"GQL_BATCH_1_{token_hex(4)}")
        k2 = _secret_keys(f"GQL_BATCH_2_{token_hex(4)}")
        k_del = f"GQL_BATCH_D_{token_hex(4)}"
        _gql(
            _app,
            _app.admin_secret,
            query=UPSERT_OR_DELETE_MUTATION,
            variables={"input": {"secrets": [{"key": k_del, "value": "v"}]}},
            operation_name="UpsertOrDeleteSecrets",
        )
        result, _ = _gql(
            _app,
            _app.admin_secret,
            query=UPSERT_OR_DELETE_MUTATION,
            variables={
                "input": {
                    "secrets": [
                        {"key": k1, "value": "v1"},
                        {"key": k2, "value": "v2"},
                        {"key": k_del, "value": None},
                    ]
                }
            },
            operation_name="UpsertOrDeleteSecrets",
        )
        assert not result.get("errors"), result.get("errors")
        payload = result["data"]["upsertOrDeleteSecrets"]
        upserted_keys = {s["key"] for s in payload["upsertedSecrets"]}
        assert upserted_keys == {k1, k2}
        assert len(payload["deletedIds"]) == 1
        assert _query_secret_value(_app, k1) == "v1"
        assert _query_secret_value(_app, k2) == "v2"
        _assert_secret_absent(_app, k_del)

    def test_duplicate_keys_last_wins(
        self, _app: _AppInfo, _secret_keys: Callable[[str], str]
    ) -> None:
        key = _secret_keys(f"GQL_DUP_{token_hex(4)}")
        result, _ = _gql(
            _app,
            _app.admin_secret,
            query=UPSERT_OR_DELETE_MUTATION,
            variables={
                "input": {
                    "secrets": [
                        {"key": key, "value": "first"},
                        {"key": key, "value": "last"},
                    ]
                }
            },
            operation_name="UpsertOrDeleteSecrets",
        )
        assert not result.get("errors"), result.get("errors")
        upserted = result["data"]["upsertOrDeleteSecrets"]["upsertedSecrets"]
        assert len(upserted) == 1
        assert upserted[0]["value"]["value"] == "last"
        assert _query_secret_value(_app, key) == "last"

    def test_recreate_after_delete(
        self, _app: _AppInfo, _secret_keys: Callable[[str], str]
    ) -> None:
        key = _secret_keys(f"GQL_RECREATE_{token_hex(4)}")
        _gql(
            _app,
            _app.admin_secret,
            query=UPSERT_OR_DELETE_MUTATION,
            variables={"input": {"secrets": [{"key": key, "value": "original"}]}},
            operation_name="UpsertOrDeleteSecrets",
        )
        _gql(
            _app,
            _app.admin_secret,
            query=UPSERT_OR_DELETE_MUTATION,
            variables={"input": {"secrets": [{"key": key, "value": None}]}},
            operation_name="UpsertOrDeleteSecrets",
        )
        result, _ = _gql(
            _app,
            _app.admin_secret,
            query=UPSERT_OR_DELETE_MUTATION,
            variables={"input": {"secrets": [{"key": key, "value": "recreated"}]}},
            operation_name="UpsertOrDeleteSecrets",
        )
        assert not result.get("errors"), result.get("errors")
        upserted = result["data"]["upsertOrDeleteSecrets"]["upsertedSecrets"]
        assert upserted[0]["value"]["value"] == "recreated"
        assert _query_secret_value(_app, key) == "recreated"


class TestSecretsAuthorization:
    """Verify admin-only access for both REST and GraphQL."""

    def test_admin_secret_can_access_rest(
        self, _app: _AppInfo, _secret_keys: Callable[[str], str]
    ) -> None:
        key = _secret_keys(f"AUTH_ADMIN_{token_hex(4)}")
        resp = _put_secrets(_app, [{"key": key, "value": "v"}], auth=_app.admin_secret)
        assert resp.status_code == 200, resp.text

    def test_logged_in_admin_can_access_rest(
        self, _app: _AppInfo, _get_user: _GetUser, _secret_keys: Callable[[str], str]
    ) -> None:
        key = _secret_keys(f"AUTH_LADMIN_{token_hex(4)}")
        admin = _get_user(_app, _ADMIN)
        resp = _put_secrets(_app, [{"key": key, "value": "v"}], auth=admin)
        assert resp.status_code == 200, resp.text

    def test_member_cannot_access_rest(self, _app: _AppInfo, _get_user: _GetUser) -> None:
        member = _get_user(_app, _MEMBER)
        resp = _put_secrets(_app, [{"key": "NOPE", "value": "v"}], auth=member)
        assert resp.status_code == 403, resp.text

    def test_viewer_cannot_access_rest(self, _app: _AppInfo, _get_user: _GetUser) -> None:
        viewer = _get_user(_app, _VIEWER)
        resp = _put_secrets(_app, [{"key": "NOPE", "value": "v"}], auth=viewer)
        assert resp.status_code == 403, resp.text

    def test_unauthenticated_cannot_access_rest(self, _app: _AppInfo) -> None:
        resp = _put_secrets(_app, [{"key": "NOPE", "value": "v"}], auth=None)
        assert resp.status_code == 401, resp.text

    def test_admin_can_mutate_secrets_graphql(
        self, _app: _AppInfo, _secret_keys: Callable[[str], str]
    ) -> None:
        key = _secret_keys(f"AUTH_GQL_ADMIN_{token_hex(4)}")
        result, _ = _gql(
            _app,
            _app.admin_secret,
            query=UPSERT_OR_DELETE_MUTATION,
            variables={"input": {"secrets": [{"key": key, "value": "v"}]}},
            operation_name="UpsertOrDeleteSecrets",
        )
        assert not result.get("errors"), result.get("errors")

    def test_member_cannot_mutate_secrets_graphql(
        self, _app: _AppInfo, _get_user: _GetUser
    ) -> None:
        member = _get_user(_app, _MEMBER)
        with pytest.raises(Unauthorized, match="Only admin can perform this action"):
            _gql(
                _app,
                member,
                query=UPSERT_OR_DELETE_MUTATION,
                variables={"input": {"secrets": [{"key": "NOPE", "value": "v"}]}},
                operation_name="UpsertOrDeleteSecrets",
            )

    def test_viewer_cannot_mutate_secrets_graphql(
        self, _app: _AppInfo, _get_user: _GetUser
    ) -> None:
        viewer = _get_user(_app, _VIEWER)
        with pytest.raises(Unauthorized, match="Viewers cannot perform this action"):
            _gql(
                _app,
                viewer,
                query=UPSERT_OR_DELETE_MUTATION,
                variables={"input": {"secrets": [{"key": "NOPE", "value": "v"}]}},
                operation_name="UpsertOrDeleteSecrets",
            )

    def test_non_admin_cannot_read_secret_value_graphql(
        self, _app: _AppInfo, _get_user: _GetUser, _secret_keys: Callable[[str], str]
    ) -> None:
        key = _secret_keys(f"AUTH_GQL_READ_{token_hex(4)}")
        _put_secrets(_app, [{"key": key, "value": "secret-val"}])
        member = _get_user(_app, _MEMBER)
        with pytest.raises(Unauthorized, match="Only admin can perform this action"):
            _gql(
                _app,
                member,
                query=SECRETS_QUERY,
                variables={"keys": [key]},
                operation_name="SecretsQuery",
            )


class TestSecretsValidation:
    """Validation edge cases through the real HTTP stack."""

    @pytest.mark.parametrize(
        "valid_key",
        [
            pytest.param("VALID_KEY", id="uppercase"),
            pytest.param("_LEADING_UNDERSCORE", id="leading_underscore"),
            pytest.param("CamelCase123", id="alphanumeric"),
            pytest.param("A1", id="short"),
        ],
    )
    def test_env_var_style_key_is_accepted(
        self, _app: _AppInfo, _secret_keys: Callable[[str], str], valid_key: str
    ) -> None:
        key = _secret_keys(valid_key)
        resp = _put_secrets(_app, [{"key": key, "value": "val"}])
        assert resp.status_code == 200, resp.text
        assert _query_secret_value(_app, key) == "val"

    def test_empty_secrets_list_returns_422(self, _app: _AppInfo) -> None:
        resp = _put_secrets(_app, [])
        assert resp.status_code == 422, resp.text

    def test_empty_key_returns_422(self, _app: _AppInfo) -> None:
        resp = _put_secrets(_app, [{"key": "   ", "value": "val"}])
        assert resp.status_code == 422, resp.text

    def test_non_ascii_key_returns_422(self, _app: _AppInfo) -> None:
        resp = _put_secrets(_app, [{"key": "КЛЮЧ", "value": "val"}])
        assert resp.status_code == 422, resp.text

    @pytest.mark.parametrize(
        "bad_key",
        [
            pytest.param("has space", id="whitespace"),
            pytest.param("has-dash", id="dash"),
            pytest.param("has.dot", id="dot"),
            pytest.param("key!", id="punctuation"),
            pytest.param("0STARTS_WITH_DIGIT", id="leading_digit"),
        ],
    )
    def test_key_outside_regex_returns_422(self, _app: _AppInfo, bad_key: str) -> None:
        resp = _put_secrets(_app, [{"key": bad_key, "value": "val"}])
        assert resp.status_code == 422, resp.text

    def test_empty_value_returns_422(self, _app: _AppInfo) -> None:
        resp = _put_secrets(_app, [{"key": "SOME_KEY", "value": "   "}])
        assert resp.status_code == 422, resp.text

    def test_missing_value_field_returns_422(self, _app: _AppInfo) -> None:
        resp = _put_secrets(_app, [{"key": "SOME_KEY"}])
        assert resp.status_code == 422, resp.text

    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param({}, id="missing_secrets_field"),
            pytest.param({"secrets": "not-a-list"}, id="secrets_not_a_list"),
        ],
    )
    def test_invalid_request_body_returns_422(
        self, _app: _AppInfo, payload: dict[str, object]
    ) -> None:
        client = _httpx_client(_app, _app.admin_secret)
        resp = client.put("v1/secrets", json=payload)
        assert resp.status_code == 422, resp.text

    def test_graphql_empty_secrets_list_returns_error(self, _app: _AppInfo) -> None:
        with pytest.raises(RuntimeError, match="At least one secret is required"):
            _gql(
                _app,
                _app.admin_secret,
                query=UPSERT_OR_DELETE_MUTATION,
                variables={"input": {"secrets": []}},
                operation_name="UpsertOrDeleteSecrets",
            )

    def test_graphql_empty_key_returns_error(self, _app: _AppInfo) -> None:
        with pytest.raises(RuntimeError, match="Key cannot be empty"):
            _gql(
                _app,
                _app.admin_secret,
                query=UPSERT_OR_DELETE_MUTATION,
                variables={"input": {"secrets": [{"key": "", "value": "v"}]}},
                operation_name="UpsertOrDeleteSecrets",
            )

    def test_graphql_key_outside_regex_returns_error(self, _app: _AppInfo) -> None:
        with pytest.raises(
            RuntimeError,
            match=(
                "Key must start with a letter or underscore and contain only "
                "letters, digits, and underscores"
            ),
        ):
            _gql(
                _app,
                _app.admin_secret,
                query=UPSERT_OR_DELETE_MUTATION,
                variables={"input": {"secrets": [{"key": "has-dash", "value": "v"}]}},
                operation_name="UpsertOrDeleteSecrets",
            )

    def test_graphql_env_var_style_key_is_accepted(
        self, _app: _AppInfo, _secret_keys: Callable[[str], str]
    ) -> None:
        key = _secret_keys("VALID_KEY")
        result, _ = _gql(
            _app,
            _app.admin_secret,
            query=UPSERT_OR_DELETE_MUTATION,
            variables={"input": {"secrets": [{"key": key, "value": "v"}]}},
            operation_name="UpsertOrDeleteSecrets",
        )
        assert not result.get("errors"), result.get("errors")
        assert _query_secret_value(_app, key) == "v"

    def test_graphql_empty_value_returns_error(self, _app: _AppInfo) -> None:
        with pytest.raises(RuntimeError, match="Value cannot be empty"):
            _gql(
                _app,
                _app.admin_secret,
                query=UPSERT_OR_DELETE_MUTATION,
                variables={"input": {"secrets": [{"key": "k", "value": ""}]}},
                operation_name="UpsertOrDeleteSecrets",
            )
