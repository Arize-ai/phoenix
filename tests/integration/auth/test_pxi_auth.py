"""Integration tests for the PXI request-source header and admin downgrade."""

from __future__ import annotations

from collections.abc import Iterator
from secrets import token_hex

import pytest

from phoenix.server.api.input_types.UserRoleInput import UserRoleInput

from .._helpers import (
    _ADMIN,
    _DENIED,
    _MEMBER,
    _VIEWER,
    _AppInfo,
    _GetUser,
    _gql,
    _LoggedInUser,
    _Profile,
)

_PXI_HEADERS = {"X-Phoenix-Request-Source": "pxi"}

_CREATE_SYSTEM_API_KEY = """
mutation ($name: String!) {
  createSystemApiKey(input: { name: $name }) {
    apiKey { id name }
  }
}
"""

_CREATE_USER_API_KEY = """
mutation ($name: String!) {
  createUserApiKey(input: { name: $name }) {
    jwt
    apiKey { id name }
  }
}
"""

_DELETE_USER_API_KEY = """
mutation ($id: ID!) {
  deleteUserApiKey(input: { id: $id }) {
    apiKeyId
  }
}
"""

_UPSERT_SECRETS = """
mutation ($key: String!, $value: String) {
  upsertOrDeleteSecrets(input: { secrets: [{ key: $key, value: $value }] }) {
    upsertedSecrets { id }
  }
}
"""

_READ_SECRET_VALUE = """
query ($keys: [String!]) {
  secrets(keys: $keys) {
    edges {
      node {
        id
        value {
          ... on DecryptedSecret { value }
          ... on UnparsableSecret { parseError }
        }
      }
    }
  }
}
"""

_CREATE_USER = """
mutation ($email: String!, $username: String!, $password: String!, $role: UserRoleInput!) {
  createUser(input: {
    email: $email, username: $username, password: $password, role: $role
  }) {
    user { id }
  }
}
"""

_CREATE_PROJECT_TRACE_RETENTION_POLICY = """
mutation ($name: String!) {
  createProjectTraceRetentionPolicy(input: {
    name: $name,
    cronExpression: "0 0 * * 0",
    rule: { maxDays: { maxDays: 30 } }
  }) {
    node { id }
  }
}
"""

_CREATE_ANNOTATION_CONFIG = """
mutation ($name: String!) {
  createAnnotationConfig(input: {
    annotationConfig: { freeform: { name: $name } }
  }) {
    annotationConfig { ... on FreeformAnnotationConfig { id } }
  }
}
"""

_LIST_USERS = "query { users { edges { node { id } } } }"
_LIST_USER_API_KEYS = "query { userApiKeys { id } }"
_LIST_SYSTEM_API_KEYS = "query { systemApiKeys { id } }"


class TestPxiAdminDowngrade:
    @pytest.fixture
    def _admin(self, _get_user: _GetUser, _app: _AppInfo) -> _LoggedInUser:
        return _get_user(_app, _ADMIN).log_in(_app)

    @pytest.fixture
    def _member(self, _get_user: _GetUser, _app: _AppInfo) -> _LoggedInUser:
        return _get_user(_app, _MEMBER).log_in(_app)

    @pytest.fixture
    def _viewer(self, _get_user: _GetUser, _app: _AppInfo) -> _LoggedInUser:
        return _get_user(_app, _VIEWER).log_in(_app)

    def test_admin_under_pxi_marker_denied_from_admin_operations(
        self,
        _admin: _LoggedInUser,
        _member: _LoggedInUser,
        _app: _AppInfo,
        _profiles: Iterator[_Profile],
    ) -> None:
        """All admin-gated GraphQL surfaces (IsAdmin / IsAdminIfAuthEnabled on
        mutations, fields, and resolver-internal `user.is_admin` branches)
        must deny an admin whose request carries the PXI marker."""
        # Top-level IsAdmin query fields.
        for query in (_LIST_USERS, _LIST_USER_API_KEYS, _LIST_SYSTEM_API_KEYS):
            with _DENIED:
                _gql(_app, _admin, query=query, headers=_PXI_HEADERS)

        # IsAdmin mutation.
        with _DENIED:
            _gql(
                _app,
                _admin,
                query=_CREATE_SYSTEM_API_KEY,
                variables={"name": f"pxi-sys-key-{token_hex(4)}"},
                headers=_PXI_HEADERS,
            )

        # IsAdminIfAuthEnabled mutation.
        with _DENIED:
            _gql(
                _app,
                _admin,
                query=_CREATE_PROJECT_TRACE_RETENTION_POLICY,
                variables={"name": f"pxi-policy-{token_hex(4)}"},
                headers=_PXI_HEADERS,
            )

        # IsAdmin mutation (user management).
        profile = next(_profiles)
        with _DENIED:
            _gql(
                _app,
                _admin,
                query=_CREATE_USER,
                variables={
                    "email": profile.email,
                    "username": profile.username,
                    "password": profile.password,
                    "role": UserRoleInput.MEMBER.value,
                },
                headers=_PXI_HEADERS,
            )

        # IsAdminIfAuthEnabled mutation + field-level guard on Secret.value.
        # Seed a secret as admin (no marker) so the read path has a
        # `Secret.value` to resolve — otherwise an empty edges list would
        # skip the IsAdminIfAuthEnabled check entirely.
        key = f"PXI_TEST_SECRET_{token_hex(4).upper()}"
        _gql(
            _app,
            _admin,
            query=_UPSERT_SECRETS,
            variables={"key": key, "value": token_hex(8)},
        )
        with _DENIED:
            _gql(
                _app,
                _admin,
                query=_UPSERT_SECRETS,
                variables={"key": key, "value": token_hex(8)},
                headers=_PXI_HEADERS,
            )
        with _DENIED:
            _gql(
                _app,
                _admin,
                query=_READ_SECRET_VALUE,
                variables={"keys": [key]},
                headers=_PXI_HEADERS,
            )

        # Resolver-internal `user.is_admin` branch in deleteUserApiKey.
        create_body, _ = _gql(
            _app,
            _member,
            query=_CREATE_USER_API_KEY,
            variables={"name": f"victim-{token_hex(4)}"},
        )
        victim_key_id = create_body["data"]["createUserApiKey"]["apiKey"]["id"]
        with _DENIED:
            _gql(
                _app,
                _admin,
                query=_DELETE_USER_API_KEY,
                variables={"id": victim_key_id},
                headers=_PXI_HEADERS,
            )

    def test_pxi_marker_does_not_escalate_member(
        self,
        _member: _LoggedInUser,
        _app: _AppInfo,
    ) -> None:
        """A member sending the PXI marker must not gain admin privileges.
        Guards against a wrapper bug that flips `is_admin=True`."""
        with _DENIED:
            _gql(
                _app,
                _member,
                query=_CREATE_SYSTEM_API_KEY,
                variables={"name": f"member-pxi-{token_hex(4)}"},
                headers=_PXI_HEADERS,
            )

    def test_pxi_marker_does_not_escalate_viewer(
        self,
        _viewer: _LoggedInUser,
        _app: _AppInfo,
    ) -> None:
        """A viewer sending the PXI marker must not gain member or admin
        privileges. Guards against a wrapper bug that flips `is_viewer=False`
        or `is_admin=True` for viewers."""
        # Not promoted to member: still denied from an IsNotViewer-gated op.
        with _DENIED:
            _gql(
                _app,
                _viewer,
                query=_CREATE_ANNOTATION_CONFIG,
                variables={"name": f"viewer-pxi-{token_hex(4)}"},
                headers=_PXI_HEADERS,
            )
        # Not promoted two levels to admin either.
        with _DENIED:
            _gql(
                _app,
                _viewer,
                query=_CREATE_SYSTEM_API_KEY,
                variables={"name": f"viewer-pxi-admin-{token_hex(4)}"},
                headers=_PXI_HEADERS,
            )
