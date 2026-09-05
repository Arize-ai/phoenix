import unittest
from typing import Optional
from unittest.mock import MagicMock

from starlette.requests import Request
from strawberry import Info

from phoenix.server.api.context import Context
from phoenix.server.api.helpers.playground_users import get_user
from phoenix.server.bearer_auth import PhoenixUser


class DummyPhoenixUser(PhoenixUser):
    def __init__(self, identity: str, is_authenticated: bool = True):
        self._identity = identity
        self._is_authenticated = is_authenticated

    @property
    def is_authenticated(self) -> bool:
        return self._is_authenticated

    @property
    def identity(self) -> str:
        return self._identity


def _create_mock_info(
    request: Optional[Request] = None,
    user: Optional[PhoenixUser] = None,
    user_raises: Optional[Exception] = None,
) -> Info[Context, None]:
    context = MagicMock(spec=Context)
    context.request = request

    if user_raises is not None:
        type(context).user = property(lambda self: (_ for _ in ()).throw(user_raises))
    else:
        context.user = user

    info = MagicMock(spec=Info)
    info.context = context
    return info


class TestPlaygroundUsersGetUser(unittest.TestCase):
    def test_get_user_with_request_and_user_in_scope(self):
        scope = {"type": "http", "user": True}
        request = Request(scope)
        user = DummyPhoenixUser(identity="42")
        info = _create_mock_info(request=request, user=user)

        self.assertEqual(get_user(info), 42)

    def test_get_user_with_request_no_user_in_scope(self):
        scope = {"type": "http"}
        request = Request(scope)
        user = DummyPhoenixUser(identity="42")
        info = _create_mock_info(request=request, user=user)

        self.assertIsNone(get_user(info))

    def test_get_user_without_request_fallback_authenticated(self):
        user = DummyPhoenixUser(identity="101", is_authenticated=True)
        info = _create_mock_info(request=None, user=user)

        self.assertEqual(get_user(info), 101)

    def test_get_user_without_request_fallback_unauthenticated(self):
        user = DummyPhoenixUser(identity="101", is_authenticated=False)
        info = _create_mock_info(request=None, user=user)

        self.assertIsNone(get_user(info))

    def test_get_user_without_request_auth_assertion_error_returns_none(self):
        info = _create_mock_info(request=None, user_raises=AssertionError("Auth unavailable"))

        self.assertIsNone(get_user(info))

    def test_get_user_without_request_auth_value_error_returns_none(self):
        info = _create_mock_info(request=None, user_raises=ValueError("No request set"))

        self.assertIsNone(get_user(info))


if __name__ == "__main__":
    unittest.main()
