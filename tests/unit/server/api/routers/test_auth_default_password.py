import contextlib
from collections.abc import AsyncIterator
from pathlib import Path
from unittest.mock import Mock, patch

import httpx
import pytest
from asgi_lifespan import LifespanManager

from phoenix.auth import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
)
from phoenix.config import ENV_PHOENIX_ENABLE_AUTH
from phoenix.session.session import ThreadSession
from tests.unit.conftest import (
    patch_dml_event_handler,
    patch_grpc_server,
    patch_online_eval_daemons,
)

_NEW_PASSWORD = "admin123"
_CUSTOM_INITIAL_PASSWORD = "custom-initial-secret"


def _configure_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(ENV_PHOENIX_ENABLE_AUTH, "true")
    monkeypatch.setenv("PHOENIX_DISABLE_RATE_LIMIT", "true")
    monkeypatch.delenv("PHOENIX_DISABLE_BASIC_AUTH", raising=False)
    monkeypatch.delenv("PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD", raising=False)


def _set_cookie_names(response: httpx.Response) -> set[str]:
    return {header.split("=", 1)[0] for header in response.headers.get_list("set-cookie")}


def _assert_no_auth_cookies(response: httpx.Response) -> None:
    names = _set_cookie_names(response)
    assert PHOENIX_ACCESS_TOKEN_COOKIE_NAME not in names
    assert PHOENIX_REFRESH_TOKEN_COOKIE_NAME not in names
    assert PHOENIX_ACCESS_TOKEN_COOKIE_NAME not in response.cookies
    assert PHOENIX_REFRESH_TOKEN_COOKIE_NAME not in response.cookies


def _assert_auth_cookies(response: httpx.Response) -> None:
    names = _set_cookie_names(response)
    assert PHOENIX_ACCESS_TOKEN_COOKIE_NAME in names
    assert PHOENIX_REFRESH_TOKEN_COOKIE_NAME in names


@contextlib.asynccontextmanager
async def _auth_client(tmp_path: Path) -> AsyncIterator[httpx.AsyncClient]:
    thread = Mock()
    thread.is_alive.return_value = True
    with patch("phoenix.session.session.ThreadServer") as mock_server:
        mock_server.return_value.run_in_thread.return_value = iter([thread])
        session = ThreadSession(
            database_url=f"sqlite:///{tmp_path / 'phoenix.db'}",
            host="127.0.0.1",
        )
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_grpc_server())
        await stack.enter_async_context(patch_dml_event_handler())
        await stack.enter_async_context(patch_online_eval_daemons())
        await stack.enter_async_context(LifespanManager(session.app))
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=session.app),
            base_url="http://test",
        ) as client:
            yield client


async def test_default_admin_password_cannot_open_a_session(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _configure_auth(monkeypatch)
    async with _auth_client(tmp_path) as client:
        wrong_password = await client.post(
            "/auth/login",
            json={"email": DEFAULT_ADMIN_EMAIL, "password": "not-the-password"},
        )
        assert wrong_password.status_code == 401
        _assert_no_auth_cookies(wrong_password)

        blocked = await client.post(
            "/auth/login",
            json={"email": DEFAULT_ADMIN_EMAIL, "password": DEFAULT_ADMIN_PASSWORD},
        )
        assert blocked.status_code == 403
        _assert_no_auth_cookies(blocked)
        body = blocked.json()
        assert body["detail"] == "The default password must be changed before signing in"
        token = body["password_reset_token"]
        assert isinstance(token, str)
        assert token

        reset = await client.post(
            "/auth/password-reset",
            json={"token": token, "password": _NEW_PASSWORD},
        )
        assert reset.status_code == 204

        logged_in = await client.post(
            "/auth/login",
            json={"email": DEFAULT_ADMIN_EMAIL, "password": _NEW_PASSWORD},
        )
    assert logged_in.status_code == 204
    _assert_auth_cookies(logged_in)


async def test_custom_initial_admin_password_opens_a_session(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _configure_auth(monkeypatch)
    monkeypatch.setenv("PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD", _CUSTOM_INITIAL_PASSWORD)
    async with _auth_client(tmp_path) as client:
        response = await client.post(
            "/auth/login",
            json={"email": DEFAULT_ADMIN_EMAIL, "password": _CUSTOM_INITIAL_PASSWORD},
        )
    assert response.status_code == 204
    _assert_auth_cookies(response)


async def test_default_admin_reset_rejects_public_password(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _configure_auth(monkeypatch)
    monkeypatch.setenv("PHOENIX_ENABLE_STRONG_PASSWORD_POLICY", "false")
    async with _auth_client(tmp_path) as client:
        blocked = await client.post(
            "/auth/login",
            json={"email": DEFAULT_ADMIN_EMAIL, "password": DEFAULT_ADMIN_PASSWORD},
        )
        assert blocked.status_code == 403
        token = blocked.json()["password_reset_token"]

        rejected = await client.post(
            "/auth/password-reset",
            json={"token": token, "password": DEFAULT_ADMIN_PASSWORD},
        )
        assert rejected.status_code == 422
        assert rejected.text == "The default password must be changed before signing in"
        _assert_no_auth_cookies(rejected)

        rejected_retry = await client.post(
            "/auth/password-reset",
            json={"token": token, "password": DEFAULT_ADMIN_PASSWORD},
        )
        assert rejected_retry.status_code == 422

        still_blocked = await client.post(
            "/auth/login",
            json={"email": DEFAULT_ADMIN_EMAIL, "password": DEFAULT_ADMIN_PASSWORD},
        )
        assert still_blocked.status_code == 403
        _assert_no_auth_cookies(still_blocked)
        first_token, token = token, still_blocked.json()["password_reset_token"]

        # Issuing a new reset token revokes the previous one.
        revoked = await client.post(
            "/auth/password-reset",
            json={"token": first_token, "password": _NEW_PASSWORD},
        )
        assert revoked.status_code == 401

        reset = await client.post(
            "/auth/password-reset",
            json={"token": token, "password": _NEW_PASSWORD},
        )
        assert reset.status_code == 204

        old_password = await client.post(
            "/auth/login",
            json={"email": DEFAULT_ADMIN_EMAIL, "password": DEFAULT_ADMIN_PASSWORD},
        )
        assert old_password.status_code == 401
        _assert_no_auth_cookies(old_password)

        logged_in = await client.post(
            "/auth/login",
            json={"email": DEFAULT_ADMIN_EMAIL, "password": _NEW_PASSWORD},
        )
        assert logged_in.status_code == 204
        _assert_auth_cookies(logged_in)
