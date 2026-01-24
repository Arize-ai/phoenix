from unittest import mock

import pytest
from fastapi import HTTPException, Request

from phoenix.server.authorization import require_admin
from phoenix.server.bearer_auth import PhoenixSystemUser, PhoenixUser
from phoenix.server.types import (
    AccessTokenId,
    UserClaimSet,
    UserId,
    UserTokenAttributes,
)


def test_require_admin_allows_admin() -> None:
    req = mock.Mock(spec=Request)
    user_id = UserId(1)
    claims = UserClaimSet(
        subject=user_id,
        token_id=AccessTokenId(1),
        attributes=UserTokenAttributes(user_role="ADMIN"),
    )
    req.user = PhoenixUser(user_id, claims)
    # Should not raise
    require_admin(req)


def test_require_admin_allows_system_user() -> None:
    req = mock.Mock(spec=Request)
    user_id = UserId(1)
    req.user = PhoenixSystemUser(user_id)
    # Should not raise
    require_admin(req)


def test_require_admin_denies_non_admin() -> None:
    req = mock.Mock(spec=Request)
    user_id = UserId(1)
    claims = UserClaimSet(
        subject=user_id,
        token_id=AccessTokenId(1),
        attributes=UserTokenAttributes(user_role="MEMBER"),
    )
    req.user = PhoenixUser(user_id, claims)
    with pytest.raises(HTTPException) as exc_info:
        require_admin(req)
    assert exc_info.value.status_code == 403
    assert "Only admin or system users" in str(exc_info.value.detail)


def test_require_admin_denies_no_user() -> None:
    req = mock.Mock(spec=Request)
    req.user = None
    with pytest.raises(HTTPException) as exc_info:
        require_admin(req)
    assert exc_info.value.status_code == 403
