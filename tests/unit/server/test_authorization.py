from unittest import mock

import pytest
from fastapi import HTTPException, Request, status

from phoenix.server.authorization import require_admin
from phoenix.server.bearer_auth import PhoenixSystemUser
from phoenix.server.types import UserId


class DummyAdminUser:
    is_admin = True


class DummyNonAdminUser:
    is_admin = False


def test_require_admin_allows_admin() -> None:
    req = mock.Mock(spec=Request)
    req.user = DummyAdminUser()
    # Should not raise
    require_admin(req)


def test_require_admin_allows_system_user() -> None:
    req = mock.Mock(spec=Request)
    # Cast to UserId to satisfy type checker
    user_id = UserId.__new__(UserId, 1)
    req.user = PhoenixSystemUser(user_id)  # type: ignore[arg-type]
    # Should not raise
    require_admin(req)


def test_require_admin_denies_non_admin() -> None:
    req = mock.Mock(spec=Request)
    req.user = DummyNonAdminUser()
    with pytest.raises(HTTPException) as exc_info:
        require_admin(req)
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "Only admin or system users" in str(exc_info.value.detail)


def test_require_admin_denies_no_user() -> None:
    req = mock.Mock(spec=Request)
    req.user = None
    with pytest.raises(HTTPException) as exc_info:
        require_admin(req)
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
