"""A password or role change ends the user's OAuth2 authorizations; a browser logout does not."""

import contextlib
from collections.abc import AsyncIterator
from datetime import datetime, timedelta, timezone
from pathlib import Path
from secrets import token_hex
from typing import Any, Literal
from unittest.mock import Mock, patch

import httpx2
import pytest
from asgi_lifespan import LifespanManager
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.auth import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD
from phoenix.config import ENV_PHOENIX_ENABLE_AUTH
from phoenix.db import models
from phoenix.db.facilitator import PHOENIX_CLI_OAUTH2_CLIENT_ID, PHOENIX_CLI_OAUTH2_REDIRECT_URIS
from phoenix.server.types import DbSessionFactory
from phoenix.session.session import ThreadSession
from tests.unit.conftest import (
    patch_dml_event_handler,
    patch_grpc_server,
)

_FIRST_PASSWORD = "first-secret"
_SECOND_PASSWORD = "second-secret"
_MEMBER_EMAIL = "member@example.com"
_REVOKED_AT = datetime(2026, 1, 1, tzinfo=timezone.utc)


@contextlib.asynccontextmanager
async def _auth_client(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> AsyncIterator[tuple[httpx2.AsyncClient, DbSessionFactory]]:
    monkeypatch.setenv(ENV_PHOENIX_ENABLE_AUTH, "true")
    monkeypatch.setenv("PHOENIX_DISABLE_RATE_LIMIT", "true")
    monkeypatch.delenv("PHOENIX_DISABLE_BASIC_AUTH", raising=False)
    monkeypatch.delenv("PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD", raising=False)
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
        await stack.enter_async_context(LifespanManager(session.app))
        async with httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=session.app),
            base_url="http://test",
        ) as client:
            yield client, session.app.state.db


async def _reset_default_password(client: httpx2.AsyncClient, password: str) -> None:
    blocked = await client.post(
        "/auth/login",
        json={"email": DEFAULT_ADMIN_EMAIL, "password": DEFAULT_ADMIN_PASSWORD},
    )
    assert blocked.status_code == 403
    reset = await client.post(
        "/auth/password-reset",
        json={"token": blocked.json()["password_reset_token"], "password": password},
    )
    assert reset.status_code == 204


async def _log_in_as_admin(client: httpx2.AsyncClient) -> None:
    await _reset_default_password(client, _FIRST_PASSWORD)
    logged_in = await client.post(
        "/auth/login",
        json={"email": DEFAULT_ADMIN_EMAIL, "password": _FIRST_PASSWORD},
    )
    assert logged_in.status_code == 204


async def _create_member(db: DbSessionFactory) -> int:
    async with db() as session:
        role_id = await session.scalar(
            select(models.UserRole.id).where(models.UserRole.name == "MEMBER")
        )
        assert role_id is not None
        user = models.LocalUser(
            email=_MEMBER_EMAIL,
            username="member",
            user_role_id=role_id,
            reset_password=False,
            password_hash=b"hash",
            password_salt=b"salt",
        )
        session.add(user)
        await session.flush()
        return user.id


async def _add_oauth2_authorizations(db: DbSessionFactory, email: str) -> int:
    """Gives the user an active grant, a revoked grant, and an unredeemed authorization code."""
    async with db() as session:
        user_id = await session.scalar(select(models.User.id).where(models.User.email == email))
        client_id = await session.scalar(
            select(models.OAuth2Client.id).where(
                models.OAuth2Client.client_id == PHOENIX_CLI_OAUTH2_CLIENT_ID
            )
        )
        assert user_id is not None and client_id is not None
        session.add(models.OAuth2Grant(user_id=user_id, oauth2_client_id=client_id))
        session.add(
            models.OAuth2Grant(user_id=user_id, oauth2_client_id=client_id, revoked_at=_REVOKED_AT)
        )
        session.add(
            models.OAuth2AuthorizationCode(
                code_hash=token_hex(16),
                user_id=user_id,
                oauth2_client_id=client_id,
                redirect_uri=PHOENIX_CLI_OAUTH2_REDIRECT_URIS[0],
                code_challenge=token_hex(16),
                code_challenge_method="S256",
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            )
        )
    return user_id


async def _oauth2_authorizations(
    db: DbSessionFactory, user_id: int
) -> tuple[int, list[datetime | None]]:
    async with db() as session:
        codes = (
            await session.scalars(
                select(models.OAuth2AuthorizationCode).where(
                    models.OAuth2AuthorizationCode.user_id == user_id
                )
            )
        ).all()
        revoked_ats = (
            await session.scalars(
                select(models.OAuth2Grant.revoked_at)
                .where(models.OAuth2Grant.user_id == user_id)
                .order_by(models.OAuth2Grant.id)
            )
        ).all()
    return len(codes), list(revoked_ats)


async def _graphql(client: httpx2.AsyncClient, query: str, variables: dict[str, Any]) -> None:
    response = await client.post("/graphql", json={"query": query, "variables": variables})
    assert response.status_code == 200
    assert "errors" not in response.json(), response.json()


_PATCH_USER = "mutation($input: PatchUserInput!) { patchUser(input: $input) { user { id } } }"
_PATCH_VIEWER = "mutation($input: PatchViewerInput!) { patchViewer(input: $input) { user { id } } }"


@pytest.mark.parametrize(
    "path",
    ["password_reset", "patch_viewer_password", "patch_user_password", "patch_user_role"],
)
async def test_log_out_ends_oauth2_authorizations(
    path: Literal[
        "password_reset",
        "patch_viewer_password",
        "patch_user_password",
        "patch_user_role",
    ],
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    async with _auth_client(monkeypatch, tmp_path) as (client, db):
        if path == "password_reset":
            user_id = await _add_oauth2_authorizations(db, DEFAULT_ADMIN_EMAIL)
            await _reset_default_password(client, _FIRST_PASSWORD)
        else:
            await _log_in_as_admin(client)
            if path == "patch_user_role":
                await _create_member(db)
                user_id = await _add_oauth2_authorizations(db, _MEMBER_EMAIL)
            else:
                user_id = await _add_oauth2_authorizations(db, DEFAULT_ADMIN_EMAIL)
            user_gid = str(GlobalID("User", str(user_id)))
            if path == "patch_viewer_password":
                await _graphql(
                    client,
                    _PATCH_VIEWER,
                    {
                        "input": {
                            "newPassword": _SECOND_PASSWORD,
                            "currentPassword": _FIRST_PASSWORD,
                        }
                    },
                )
            elif path == "patch_user_password":
                await _graphql(
                    client,
                    _PATCH_USER,
                    {"input": {"userId": user_gid, "newPassword": _SECOND_PASSWORD}},
                )
            else:
                await _graphql(
                    client, _PATCH_USER, {"input": {"userId": user_gid, "newRole": "VIEWER"}}
                )
        num_codes, revoked_ats = await _oauth2_authorizations(db, user_id)
    assert num_codes == 0
    # The active grant is revoked now; the revoked grant keeps its original revocation time.
    assert len(revoked_ats) == 2
    assert revoked_ats[0] is not None
    assert revoked_ats[1] == _REVOKED_AT


async def test_patch_user_without_log_out_keeps_oauth2_authorizations(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    async with _auth_client(monkeypatch, tmp_path) as (client, db):
        await _log_in_as_admin(client)
        user_id = await _add_oauth2_authorizations(db, DEFAULT_ADMIN_EMAIL)
        await _graphql(
            client,
            _PATCH_USER,
            {
                "input": {
                    "userId": str(GlobalID("User", str(user_id))),
                    "newUsername": "renamed-admin",
                }
            },
        )
        num_codes, revoked_ats = await _oauth2_authorizations(db, user_id)
    assert num_codes == 1
    assert revoked_ats[0] is None


async def test_browser_log_out_keeps_oauth2_authorizations(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    async with _auth_client(monkeypatch, tmp_path) as (client, db):
        await _log_in_as_admin(client)
        user_id = await _add_oauth2_authorizations(db, DEFAULT_ADMIN_EMAIL)
        async with db() as session:
            grant_id = await session.scalar(
                select(models.OAuth2Grant.id).where(
                    models.OAuth2Grant.user_id == user_id,
                    models.OAuth2Grant.revoked_at.is_(None),
                )
            )
            assert grant_id is not None
            # The CLI's refresh token, issued under the grant.
            session.add(
                models.RefreshToken(
                    user_id=user_id,
                    expires_at=datetime.now(timezone.utc) + timedelta(days=1),
                    oauth2_grant_id=grant_id,
                )
            )
        response = await client.get("/auth/logout")
        assert response.status_code == 302
        num_codes, revoked_ats = await _oauth2_authorizations(db, user_id)
        async with db() as session:
            refresh_token_grant_ids = (
                await session.scalars(
                    select(models.RefreshToken.oauth2_grant_id).where(
                        models.RefreshToken.user_id == user_id
                    )
                )
            ).all()
    # The browser session's refresh token is gone; the CLI's grant and refresh token remain.
    assert refresh_token_grant_ids == [grant_id]
    assert num_codes == 1
    assert revoked_ats[0] is None
