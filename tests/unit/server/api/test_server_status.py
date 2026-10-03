from __future__ import annotations

from collections.abc import Awaitable
from types import SimpleNamespace
from typing import Any, Optional, cast

import pytest

from phoenix.db.models import UserRoleName
from phoenix.server.api.queries import Query
from phoenix.server.api.types.ServerStatus import ServerStatus
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.types import (
    AccessTokenAttributes,
    AccessTokenClaims,
    AccessTokenId,
    RefreshTokenId,
    UserId,
)


def _user(role: UserRoleName) -> PhoenixUser:
    user_id = UserId(1)
    return PhoenixUser(
        user_id,
        AccessTokenClaims(
            subject=user_id,
            token_id=AccessTokenId(1),
            attributes=AccessTokenAttributes(
                user_role=role,
                refresh_token_id=RefreshTokenId(1),
            ),
        ),
    )


class _Context:
    def __init__(
        self,
        *,
        auth_enabled: bool,
        key_is_public: bool,
        user: Optional[PhoenixUser],
    ) -> None:
        self.auth_enabled = auth_enabled
        self.database_encryption_key_is_public = key_is_public
        self.db = SimpleNamespace(should_not_insert_or_update=False)
        self._user = user

    @property
    def user(self) -> PhoenixUser:
        if self._user is None:
            raise AssertionError("viewer is not read when authentication is disabled")
        return self._user


@pytest.mark.parametrize(
    ("auth_enabled", "role", "key_is_public", "expected"),
    [
        pytest.param(True, "ADMIN", True, True, id="admin-public-key"),
        pytest.param(True, "ADMIN", False, False, id="admin-private-key"),
        pytest.param(True, "MEMBER", True, None, id="member"),
        pytest.param(False, None, True, True, id="auth-disabled-public-key"),
        pytest.param(False, None, False, False, id="auth-disabled-private-key"),
    ],
)
async def test_database_encryption_key_is_public_follows_admin_access(
    auth_enabled: bool,
    role: Optional[UserRoleName],
    key_is_public: bool,
    expected: Optional[bool],
) -> None:
    info = cast(
        Any,
        SimpleNamespace(
            context=_Context(
                auth_enabled=auth_enabled,
                key_is_public=key_is_public,
                user=_user(role) if role is not None else None,
            )
        ),
    )
    # Strawberry types the field as StrawberryField; the call returns the coroutine.
    status = await cast(Awaitable[ServerStatus], Query().server_status(info))
    assert status.database_encryption_key_is_public is expected
