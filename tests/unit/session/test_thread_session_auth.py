import contextlib
import os
import socket
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from asgi_lifespan import LifespanManager
from sqlalchemy import select

import phoenix.session.session as session_module
from phoenix.auth import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD
from phoenix.config import (
    ENV_PHOENIX_DISABLE_BASIC_AUTH,
    ENV_PHOENIX_ENABLE_AUTH,
    ENV_PHOENIX_LDAP_HOST,
    ENV_PHOENIX_SMTP_HOSTNAME,
    ENV_PHOENIX_SMTP_MAIL_FROM,
    ENV_PHOENIX_SMTP_PASSWORD,
    ENV_PHOENIX_SMTP_PORT,
    ENV_PHOENIX_SMTP_USERNAME,
    ENV_PHOENIX_SMTP_VALIDATE_CERTS,
    get_env_access_token_expiry,
    get_env_auth_settings,
    get_env_password_reset_token_expiry,
    get_env_phoenix_secret,
    get_env_refresh_token_expiry,
)
from phoenix.db import models
from phoenix.server.email.sender import SimpleEmailSender
from phoenix.session.session import ThreadSession, launch_app
from tests.unit.conftest import (
    patch_dml_event_handler,
    patch_grpc_server,
    patch_online_eval_daemons,
)


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _clear_login_providers(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(ENV_PHOENIX_LDAP_HOST, raising=False)
    for key in [key for key in os.environ if key.startswith("PHOENIX_OAUTH2_")]:
        monkeypatch.delenv(key, raising=False)


@pytest.mark.parametrize(
    "host, expected",
    [
        pytest.param("0.0.0.0", True, id="non_loopback"),
        pytest.param("127.0.0.1", False, id="loopback"),
    ],
)
def test_thread_session_auth_follows_host(
    monkeypatch: pytest.MonkeyPatch, host: str, expected: bool
) -> None:
    monkeypatch.delenv(ENV_PHOENIX_ENABLE_AUTH, raising=False)
    monkeypatch.delenv(ENV_PHOENIX_DISABLE_BASIC_AUTH, raising=False)
    _clear_login_providers(monkeypatch)
    engine = SimpleNamespace(dialect=SimpleNamespace(name="sqlite"), dispose=Mock())
    thread = Mock()
    thread.is_alive.return_value = True
    with (
        patch.object(session_module, "_session", None),
        patch("phoenix.session.session.create_engine", return_value=engine),
        patch("phoenix.session.session.instrument_engine_if_enabled", return_value=[]),
        patch("phoenix.session.session.create_app") as mock_create_app,
    ):
        mock_create_app.return_value = Mock()
        with patch("phoenix.session.session.ThreadServer") as mock_server:
            mock_server.return_value.run_in_thread.return_value = iter([thread])
            ThreadSession(database_url="sqlite://", host=host)
    assert mock_create_app.call_args is not None
    kwargs = mock_create_app.call_args.kwargs
    assert kwargs["authentication_enabled"] is expected
    assert kwargs["secret"] == get_env_phoenix_secret()
    assert kwargs["access_token_expiry"] == get_env_access_token_expiry()
    assert kwargs["refresh_token_expiry"] == get_env_refresh_token_expiry()
    assert kwargs["password_reset_token_expiry"] == get_env_password_reset_token_expiry()


async def test_thread_session_login_with_auth(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv(ENV_PHOENIX_ENABLE_AUTH, "true")
    monkeypatch.setenv("PHOENIX_DISABLE_RATE_LIMIT", "true")
    monkeypatch.delenv("PHOENIX_DISABLE_BASIC_AUTH", raising=False)
    monkeypatch.delenv("PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD", raising=False)
    database = tmp_path / "phoenix.db"
    thread = Mock()
    thread.is_alive.return_value = True
    with patch("phoenix.session.session.ThreadServer") as mock_server:
        mock_server.return_value.run_in_thread.return_value = iter([thread])
        session = ThreadSession(
            database_url=f"sqlite:///{database}",
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
            response = await client.post(
                "/auth/login",
                json={"email": DEFAULT_ADMIN_EMAIL, "password": DEFAULT_ADMIN_PASSWORD},
            )
    assert response.status_code == 403
    body = response.json()
    assert isinstance(body.get("password_reset_token"), str)
    assert body["password_reset_token"]


def test_thread_session_binds_canonical_grpc_host(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    grpc_port = _free_port()
    monkeypatch.setenv("PHOENIX_GRPC_PORT", str(grpc_port))
    monkeypatch.delenv(ENV_PHOENIX_ENABLE_AUTH, raising=False)
    monkeypatch.delenv(ENV_PHOENIX_DISABLE_BASIC_AUTH, raising=False)
    _clear_login_providers(monkeypatch)
    session = ThreadSession(
        database_url=f"sqlite:///{tmp_path / 'phoenix.db'}",
        host="127.1",
        port=_free_port(),
    )
    try:
        assert session.host == "127.0.0.1"
        assert session.active
        with socket.create_connection(("127.0.0.1", grpc_port), timeout=5):
            pass
    finally:
        session.end()


def test_explicit_non_loopback_host_without_a_login_method_matches_the_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(ENV_PHOENIX_ENABLE_AUTH, raising=False)
    monkeypatch.delenv("PHOENIX_SECRET", raising=False)
    monkeypatch.delenv("PHOENIX_ADMIN_SECRET", raising=False)
    monkeypatch.setenv(ENV_PHOENIX_DISABLE_BASIC_AUTH, "true")
    _clear_login_providers(monkeypatch)
    monkeypatch.setenv("PHOENIX_HOST", "0.0.0.0")
    with pytest.raises(ValueError) as environment_error:
        get_env_auth_settings()
    monkeypatch.delenv("PHOENIX_HOST", raising=False)
    with pytest.raises(ValueError) as session_error:
        ThreadSession(database_url="sqlite://", host="0.0.0.0")
    try:
        with (
            patch.object(session_module, "_session", None),
            pytest.raises(ValueError) as launch_error,
        ):
            launch_app(host="0.0.0.0")
    finally:
        if (working_dir := session_module._session_working_dir) is not None:
            session_module._session_working_dir = None
            working_dir.cleanup()
    assert str(session_error.value) == str(environment_error.value)
    assert str(launch_error.value) == str(environment_error.value)


async def test_thread_session_password_reset_uses_configured_smtp(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    smtp_hostname = "smtp.thread-session.test"
    smtp_port = 24681
    smtp_username = "thread-session-smtp-user"
    smtp_password = "thread-session-smtp-secret"
    smtp_mail_from = "phoenix-thread-session@example.com"
    user_email = "local-reset@thread-session.test"
    monkeypatch.setenv(ENV_PHOENIX_ENABLE_AUTH, "true")
    monkeypatch.setenv("PHOENIX_DISABLE_RATE_LIMIT", "true")
    monkeypatch.delenv(ENV_PHOENIX_DISABLE_BASIC_AUTH, raising=False)
    monkeypatch.setenv(ENV_PHOENIX_SMTP_HOSTNAME, smtp_hostname)
    monkeypatch.setenv(ENV_PHOENIX_SMTP_PORT, str(smtp_port))
    monkeypatch.setenv(ENV_PHOENIX_SMTP_USERNAME, smtp_username)
    monkeypatch.setenv(ENV_PHOENIX_SMTP_PASSWORD, smtp_password)
    monkeypatch.setenv(ENV_PHOENIX_SMTP_MAIL_FROM, smtp_mail_from)
    monkeypatch.setenv(ENV_PHOENIX_SMTP_VALIDATE_CERTS, "false")
    thread = Mock()
    thread.is_alive.return_value = True
    with patch("phoenix.session.session.ThreadServer") as mock_server:
        mock_server.return_value.run_in_thread.return_value = iter([thread])
        session = ThreadSession(
            database_url=f"sqlite:///{tmp_path / 'phoenix.db'}",
            host="127.0.0.1",
        )
    sender = session.app.state.email_sender
    assert isinstance(sender, SimpleEmailSender)
    assert sender.smtp_server == smtp_hostname
    assert sender.smtp_port == smtp_port
    assert sender.username == smtp_username
    assert sender.password == smtp_password
    assert sender.sender_email == smtp_mail_from
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_grpc_server())
        await stack.enter_async_context(patch_dml_event_handler())
        await stack.enter_async_context(patch_online_eval_daemons())
        await stack.enter_async_context(LifespanManager(session.app))
        async with session.app.state.db() as db_session:
            role_id = await db_session.scalar(select(models.UserRole.id).limit(1))
            assert role_id is not None
            db_session.add(
                models.User(
                    email=user_email,
                    username="local-reset",
                    user_role_id=role_id,
                    reset_password=False,
                    auth_method="LOCAL",
                    password_hash=b"hash",
                    password_salt=b"salt",
                )
            )
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=session.app),
            base_url="http://test",
        ) as client:
            with patch.object(
                sender, "send_password_reset_email", new_callable=AsyncMock
            ) as send_password_reset_email:
                response = await client.post(
                    "/auth/password-reset-email",
                    json={"email": user_email},
                )
    assert response.status_code == 204
    assert response.text != "SMTP server not configured"
    send_password_reset_email.assert_awaited_once()
    await_args = send_password_reset_email.await_args
    assert await_args is not None
    (sent_email, reset_url), _kwargs = await_args
    assert sent_email == user_email
    reset = urlparse(reset_url)
    assert reset.scheme
    assert reset.netloc
    assert reset.path == "/reset-password-with-token"
    token = parse_qs(reset.query).get("token")
    assert token and token[0]
