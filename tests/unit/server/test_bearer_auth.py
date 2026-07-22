"""Unit tests for bearer-token authentication.

Covers the in-process principal path: internal dispatch (the mounted MCP server
calling back into /v1) authenticates by placing an already-authenticated
``PhoenixUser`` in the ASGI scope rather than replaying the caller's bearer
token. The backend must accept exactly that — a ``PhoenixUser`` under the scope
key — and nothing an external request could fabricate, since external requests
control headers but never scope keys.
"""

from __future__ import annotations

from unittest.mock import MagicMock

from starlette.requests import HTTPConnection

from phoenix.server.bearer_auth import (
    INTERNAL_PRINCIPAL_SCOPE_KEY,
    BearerTokenAuthBackend,
    PhoenixUser,
    token_audience_permits,
)
from phoenix.server.types import (
    AccessTokenAttributes,
    AccessTokenClaims,
    AccessTokenId,
    RefreshTokenId,
    UserId,
)


def _phoenix_user() -> PhoenixUser:
    user_id = UserId(1)
    claims = AccessTokenClaims(
        subject=user_id,
        token_id=AccessTokenId(1),
        attributes=AccessTokenAttributes(
            user_role="MEMBER",
            refresh_token_id=RefreshTokenId(1),
        ),
    )
    return PhoenixUser(user_id, claims)


def _connection(
    *,
    scope_extra: dict[str, object] | None = None,
    headers: list[tuple[bytes, bytes]] | None = None,
) -> HTTPConnection:
    scope = {
        "type": "http",
        "headers": headers or [],
        **(scope_extra or {}),
    }
    return HTTPConnection(scope)


async def test_internal_principal_in_scope_authenticates_without_a_token_read() -> None:
    token_store = MagicMock()
    backend = BearerTokenAuthBackend(token_store)
    principal = _phoenix_user()

    result = await backend.authenticate(
        _connection(scope_extra={INTERNAL_PRINCIPAL_SCOPE_KEY: principal})
    )

    assert result is not None
    _, user = result
    # The internal request runs as the very principal authenticated at the outer
    # request — same object, no second token-store round trip.
    assert user is principal
    token_store.read.assert_not_called()


async def test_internal_principal_key_sent_as_header_does_not_authenticate() -> None:
    """The scope key's spelling arriving as an HTTP header must mean nothing.

    External requests can put any name in a header, but only in-process code can
    put a key in the ASGI scope — that asymmetry is the entire security argument
    for principal passing, so pin it."""
    backend = BearerTokenAuthBackend(MagicMock())

    result = await backend.authenticate(
        _connection(headers=[(INTERNAL_PRINCIPAL_SCOPE_KEY.encode(), b"anything")])
    )

    assert result is None


async def test_non_phoenix_user_under_internal_principal_key_is_ignored() -> None:
    backend = BearerTokenAuthBackend(MagicMock())

    result = await backend.authenticate(
        _connection(scope_extra={INTERNAL_PRINCIPAL_SCOPE_KEY: "not-a-user"})
    )

    assert result is None


def _claims_with_audience(audience: object) -> MagicMock:
    claims = MagicMock()
    claims.audience = audience
    return claims


def test_token_audience_permits_unscoped_token_valid_everywhere() -> None:
    """A token with no audience (None or empty) is unscoped and valid at any
    resource: API keys, web sessions, and OAuth tokens minted without a resource
    indicator must never be rejected by audience confinement."""
    origin = "https://phoenix.example"
    assert token_audience_permits(_claims_with_audience(None), (origin,))
    assert token_audience_permits(_claims_with_audience([]), (origin,))


def test_token_audience_permits_confines_a_scoped_token_to_its_resource() -> None:
    """A resource-scoped token is valid only where one of its audiences is
    allowed. The /mcp guard allows {origin, origin/mcp}; the /v1 dependency allows
    {origin} only, which is what rejects an /mcp token replayed at /v1."""
    origin = "https://phoenix.example"
    mcp = "https://phoenix.example/mcp"
    assert token_audience_permits(_claims_with_audience([mcp]), (origin, mcp))
    assert not token_audience_permits(_claims_with_audience([mcp]), (origin,))
    assert token_audience_permits(_claims_with_audience([origin]), (origin,))
