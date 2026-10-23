from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI, Request
from pydantic import SecretStr
from sqlalchemy import select
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response
from strawberry.relay import GlobalID

from phoenix.auth import compute_password_hash
from phoenix.db import models
from phoenix.server.api.routers.v1 import create_v1_router
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.types import (
    AccessTokenAttributes,
    AccessTokenClaims,
    AccessTokenId,
    DbSessionFactory,
    RefreshTokenId,
    UserId,
)


@pytest.fixture
async def user(db: DbSessionFactory) -> models.LocalUser:
    async with db() as session:
        role = await session.scalar(select(models.UserRole).where(models.UserRole.name == "ADMIN"))
        if role is None:
            role = models.UserRole(name="ADMIN")
            session.add(role)
            await session.flush()
        salt = b"test-password-salt"
        user = models.LocalUser(
            email="patch-user@example.com",
            username="patch-user",
            user_role_id=role.id,
            password_hash=compute_password_hash(password=SecretStr("original-password"), salt=salt),
            password_salt=salt,
        )
        session.add(user)
        await session.flush()
        return user


def _principal(user_id: int, *, grant_id: int | None = None) -> PhoenixUser:
    return PhoenixUser(
        UserId(user_id),
        AccessTokenClaims(
            subject=UserId(user_id),
            token_id=AccessTokenId(1),
            attributes=AccessTokenAttributes(
                user_role="ADMIN",
                refresh_token_id=RefreshTokenId(1),
                grant_id=grant_id,
                scopes=("read", "write") if grant_id else None,
            ),
        ),
    )


@pytest.fixture
def patch_app(db: DbSessionFactory, user: models.LocalUser) -> FastAPI:
    app = FastAPI()
    app.state.authentication_enabled = True
    app.state.read_only = False
    app.state.db = db
    app.state.principal = _principal(user.id)
    app.state.token_store = AsyncMock()
    app.state.get_token_store = lambda: app.state.token_store
    app.include_router(create_v1_router(authentication_enabled=True))

    @app.middleware("http")
    async def authenticate(request: Request, call_next: RequestResponseEndpoint) -> Response:
        request.scope["user"] = app.state.principal
        return await call_next(request)

    return app


@pytest.fixture
async def patch_client(patch_app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(patch_app), base_url="http://test"
    ) as client:
        yield client


@pytest.mark.parametrize(
    "body", [{"username": "changed"}, {"password": "new-password"}, {"role": "ADMIN"}]
)
async def test_patch_user_requires_authentication_enabled(
    body: dict[str, str],
    httpx_client: httpx.AsyncClient,
) -> None:
    response = await httpx_client.patch(f"v1/users/{GlobalID('User', '1')}", json=body)
    assert response.status_code == 403


@pytest.mark.parametrize(
    "body", [{"username": "changed"}, {"password": "new-password"}, {"role": "ADMIN"}]
)
async def test_delegated_oauth_access_token_cannot_modify_users(
    body: dict[str, str],
    patch_client: httpx.AsyncClient,
    patch_app: FastAPI,
    user: models.LocalUser,
) -> None:
    # Even an otherwise valid, unscoped ADMIN token issued to an OAuth client is delegated.
    patch_app.state.principal = _principal(user.id, grant_id=1)
    response = await patch_client.patch(f"v1/users/{GlobalID('User', str(user.id))}", json=body)
    assert response.status_code == 403
    patch_app.state.token_store.log_out.assert_not_called()


@pytest.mark.parametrize("self_update", [False, True])
@pytest.mark.parametrize("role_name", ["MEMBER", "VIEWER", "SYSTEM"])
async def test_cached_admin_claims_cannot_override_current_database_role(
    self_update: bool,
    role_name: str,
    patch_client: httpx.AsyncClient,
    patch_app: FastAPI,
    user: models.LocalUser,
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        role = await session.scalar(
            select(models.UserRole).where(models.UserRole.name == role_name)
        )
        if role is None:
            role = models.UserRole(name=role_name)
            session.add(role)
            await session.flush()
        stored = await session.get(models.User, user.id)
        assert stored is not None
        stored.user_role_id = role.id
    # Cached ADMIN claims must not permit either self-service or account enumeration
    # after the caller's database role changes.
    target_id = user.id if self_update else 999999999
    response = await patch_client.patch(
        f"v1/users/{GlobalID('User', str(target_id))}", json={"username": "forbidden"}
    )
    assert response.status_code == 403
    patch_app.state.token_store.log_out.assert_not_called()
    async with db() as session:
        stored = await session.get(models.User, user.id)
        assert stored is not None and stored.username == user.username


async def test_basic_auth_disabled_rejects_password_without_mutating_profile(
    monkeypatch: pytest.MonkeyPatch,
    patch_client: httpx.AsyncClient,
    user: models.LocalUser,
    db: DbSessionFactory,
) -> None:
    monkeypatch.setenv("PHOENIX_DISABLE_BASIC_AUTH", "true")
    response = await patch_client.patch(
        f"v1/users/{GlobalID('User', str(user.id))}",
        json={
            "username": "forbidden",
            "password": "new-password",
            "current_password": "original-password",
        },
    )
    assert response.status_code == 400
    async with db() as session:
        stored = await session.get(models.User, user.id)
        assert stored is not None and stored.username == user.username


@pytest.mark.parametrize("setting,status_code", [("read_only", 403), ("storage_lock", 507)])
async def test_profile_updates_respect_deployment_write_guards(
    setting: str,
    status_code: int,
    patch_client: httpx.AsyncClient,
    patch_app: FastAPI,
    user: models.LocalUser,
) -> None:
    if setting == "read_only":
        patch_app.state.read_only = True
    else:
        patch_app.state.db.should_not_insert_or_update = True
    response = await patch_client.patch(
        f"v1/users/{GlobalID('User', str(user.id))}", json={"username": "forbidden"}
    )
    assert response.status_code == status_code
    patch_app.state.token_store.log_out.assert_not_called()
