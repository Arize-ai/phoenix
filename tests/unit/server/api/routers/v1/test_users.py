from __future__ import annotations

import contextlib
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import AsyncIterator

import httpx
from asgi_lifespan import LifespanManager
from fastapi import FastAPI
from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from strawberry.relay import GlobalID

from phoenix.auth import Token
from phoenix.db import models
from phoenix.server.app import create_app
from phoenix.server.bearer_auth import create_access_and_refresh_tokens
from phoenix.server.jwt_store import JwtStore
from phoenix.server.types import (
    ApiKeyAttributes,
    ApiKeyClaims,
    DbSessionFactory,
    PasswordResetTokenClaims,
    TokenId,
    UserId,
)
from tests.unit.conftest import TestBulkInserter, patch_grpc_server


@contextlib.asynccontextmanager
async def _auth_app(db: DbSessionFactory) -> AsyncIterator[tuple[FastAPI, httpx.AsyncClient]]:
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=True,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
            secret=SecretStr("test-secret-at-least-32-chars-long!!"),
        )
        manager = await stack.enter_async_context(LifespanManager(app))
        client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=manager.app), base_url="http://test"
        )
        yield app, client


async def _add_user(db: DbSessionFactory, role: models.UserRoleName) -> models.User:
    async with db() as session:
        role_id = await session.scalar(select(models.UserRole.id).filter_by(name=role))
        user = models.LocalUser(
            email=f"{token_hex(8)}@example.com",
            username=token_hex(8),
            password_hash=b"hash",
            password_salt=b"salt",
            reset_password=False,
            user_role_id=role_id,
        )
        session.add(user)
        await session.flush()
        loaded = await session.scalar(
            select(models.User).filter_by(id=user.id).options(joinedload(models.User.role))
        )
    assert loaded is not None
    return loaded


async def _api_key(token_store: JwtStore, user: models.User) -> Token:
    key, _ = await token_store.create_api_key(
        ApiKeyClaims(
            subject=UserId(user.id),
            issued_at=datetime.now(timezone.utc),
            attributes=ApiKeyAttributes(user_role=user.role.name, name="key"),
        )
    )
    return key


def _bearer(token: Token) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


class TestDeleteUser:
    async def test_deleting_a_user_deletes_and_revokes_all_of_their_tokens(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with _auth_app(db) as (app, client):
            token_store: JwtStore = app.state.get_token_store()
            admin = await _add_user(db, "ADMIN")
            member = await _add_user(db, "MEMBER")
            admin_key = await _api_key(token_store, admin)
            member_key = await _api_key(token_store, member)
            now = datetime.now(timezone.utc)
            password_reset_token, _ = await token_store.create_password_reset_token(
                PasswordResetTokenClaims(
                    subject=UserId(member.id),
                    issued_at=now,
                    expiration_time=now + timedelta(hours=1),
                )
            )
            access_token, refresh_token = await create_access_and_refresh_tokens(
                token_store=token_store,
                user=member,
                access_token_expiry=timedelta(minutes=10),
                refresh_token_expiry=timedelta(days=1),
            )
            member_tokens: list[Token] = [
                member_key,
                password_reset_token,
                access_token,
                refresh_token,
            ]
            token_ids: list[TokenId] = []
            for token in member_tokens:
                claims = await token_store.read(token)
                assert claims is not None and isinstance(claims.token_id, TokenId)
                token_ids.append(claims.token_id)
            assert (await client.get("v1/projects", headers=_bearer(member_key))).status_code == 200

            response = await client.delete(
                f"v1/users/{GlobalID('User', str(member.id))}", headers=_bearer(admin_key)
            )
            assert response.status_code == 204

            # Every token was cached when it was created, so it only stops reading this soon if
            # the delete evicted it from the token store.
            assert (await client.get("v1/projects", headers=_bearer(member_key))).status_code == 401
            for token in member_tokens:
                assert await token_store.read(token) is None
            async with db() as session:
                assert await session.get(models.User, member.id) is None
                for token_id in token_ids:
                    assert await session.get(token_id.table, int(token_id)) is None, token_id
