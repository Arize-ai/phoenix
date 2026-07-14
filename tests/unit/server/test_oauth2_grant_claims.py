"""Unit tests for OAuth2 grant claim hydration.

These tests run with authentication disabled and cover pure claim/role logic only.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from unittest.mock import MagicMock

import pytest

from phoenix.auth import ClaimSetStatus
from phoenix.db import models
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.jwt_store import _fail_closed_subject, _scopes_tuple
from phoenix.server.types import (
    AccessTokenAttributes,
    AccessTokenClaims,
    AccessTokenId,
    RefreshTokenId,
    UserId,
)


def test_scopes_tuple_none() -> None:
    assert _scopes_tuple(None) is None


def test_scopes_tuple_list() -> None:
    assert _scopes_tuple(["example"]) == ("example",)


def test_fail_closed_subject_legacy_null_scopes() -> None:
    """Tokens with no grant keep full-role access when scopes is NULL."""
    assert _fail_closed_subject(7, grant_id=None, scopes=None) == UserId(7)


def test_fail_closed_subject_grant_with_scopes() -> None:
    assert _fail_closed_subject(7, grant_id=3, scopes=()) == UserId(7)


def test_fail_closed_subject_grant_linked_null_scopes() -> None:
    """A grant-linked row with NULL scopes is invalid — never full-role access."""
    assert _fail_closed_subject(7, grant_id=3, scopes=None) is None


def test_access_token_from_db_legacy_semantics() -> None:
    """Web-session access tokens hydrate with NULL scopes and no grant_id."""
    from phoenix.server.jwt_store import _AccessTokenStore

    store = object.__new__(_AccessTokenStore)
    record = models.AccessToken(
        id=1,
        user_id=2,
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        refresh_token_id=5,
        scopes=None,
    )
    # Bypass SQLAlchemy instrumentation for unit construction
    record.id = 1
    token_id, claims = store._from_db(record, "ADMIN", grant_id=None)
    assert token_id == AccessTokenId(1)
    assert claims.subject == UserId(2)
    assert claims.status is ClaimSetStatus.VALID
    assert claims.attributes is not None
    assert claims.attributes.grant_id is None
    assert claims.attributes.scopes is None
    assert claims.attributes.user_role == "ADMIN"


def test_access_token_from_db_grant_linked_with_scopes() -> None:
    from phoenix.server.jwt_store import _AccessTokenStore

    store = object.__new__(_AccessTokenStore)
    record = models.AccessToken(
        id=1,
        user_id=2,
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        refresh_token_id=5,
        scopes=[],
    )
    record.id = 1
    token_id, claims = store._from_db(record, "ADMIN", grant_id=9)
    assert claims.subject == UserId(2)
    assert claims.status is ClaimSetStatus.VALID
    assert claims.attributes is not None
    assert claims.attributes.grant_id == 9
    assert claims.attributes.scopes == ()


def test_access_token_from_db_grant_linked_null_scopes_invalid() -> None:
    from phoenix.server.jwt_store import _AccessTokenStore

    store = object.__new__(_AccessTokenStore)
    record = models.AccessToken(
        id=1,
        user_id=2,
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        refresh_token_id=5,
        scopes=None,
    )
    record.id = 1
    _, claims = store._from_db(record, "ADMIN", grant_id=9)
    assert claims.subject is None
    assert claims.status is ClaimSetStatus.INVALID


def test_refresh_token_from_db_grant_linked_null_scopes_invalid() -> None:
    from phoenix.server.jwt_store import _RefreshTokenStore

    store = object.__new__(_RefreshTokenStore)
    record = models.RefreshToken(
        id=1,
        user_id=2,
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        oauth2_grant_id=9,
        scopes=None,
    )
    record.id = 1
    _, claims = store._from_db(record, "MEMBER")
    assert claims.subject is None
    assert claims.status is ClaimSetStatus.INVALID


def test_refresh_token_from_db_legacy_semantics() -> None:
    from phoenix.server.jwt_store import _RefreshTokenStore

    store = object.__new__(_RefreshTokenStore)
    record = models.RefreshToken(
        id=1,
        user_id=2,
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        oauth2_grant_id=None,
        scopes=None,
    )
    record.id = 1
    _, claims = store._from_db(record, "MEMBER")
    assert claims.subject == UserId(2)
    assert claims.status is ClaimSetStatus.VALID
    assert claims.attributes is not None
    assert claims.attributes.grant_id is None
    assert claims.attributes.scopes is None


@pytest.mark.parametrize(
    ("user_role", "scopes", "expect_admin", "expect_viewer"),
    [
        ("ADMIN", None, True, False),
        ("MEMBER", None, False, False),
        ("VIEWER", None, False, True),
        ("ADMIN", (), True, False),
        ("MEMBER", (), False, False),
        ("VIEWER", (), False, True),
    ],
)
def test_phoenix_user_role_flags(
    user_role: str,
    scopes: Optional[tuple[str, ...]],
    expect_admin: bool,
    expect_viewer: bool,
) -> None:
    """Grant-linked tokens carry the account's own role — grants do not re-scope it."""
    user_id = UserId(1)
    claims = AccessTokenClaims(
        subject=user_id,
        token_id=AccessTokenId(1),
        attributes=AccessTokenAttributes(
            user_role=user_role,  # type: ignore[arg-type]
            refresh_token_id=RefreshTokenId(1),
            grant_id=3 if scopes is not None else None,
            scopes=scopes,
        ),
    )
    user = PhoenixUser(user_id, claims)
    assert user.is_admin is expect_admin
    assert user.is_viewer is expect_viewer


def test_create_access_and_refresh_tokens_requires_scopes_with_grant() -> None:
    import asyncio

    from phoenix.server.bearer_auth import create_access_and_refresh_tokens

    user = MagicMock()
    user.id = 1
    user.role.name = "ADMIN"
    token_store = MagicMock()

    async def _run() -> None:
        with pytest.raises(ValueError, match="scopes are required"):
            await create_access_and_refresh_tokens(
                token_store=token_store,
                user=user,
                access_token_expiry=timedelta(minutes=10),
                refresh_token_expiry=timedelta(days=7),
                grant_id=1,
                scopes=None,
            )

    asyncio.run(_run())
