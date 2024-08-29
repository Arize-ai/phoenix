import asyncio
from datetime import datetime, timezone

import strawberry
from sqlalchemy import delete, select
from sqlalchemy.orm import joinedload
from strawberry.types import Info

from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_ACCESS_TOKEN_MAX_AGE,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_MAX_AGE,
    is_valid_password,
)
from phoenix.db import enums, models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.mutations.auth import HasSecret, IsAuthenticated, IsNotReadOnly
from phoenix.server.types import (
    AccessTokenAttributes,
    AccessTokenClaims,
    AccessTokenId,
    RefreshTokenAttributes,
    RefreshTokenClaims,
    RefreshTokenId,
    UserId,
)

FAILED_LOGIN_MESSAGE = "login failed"


@strawberry.input
class LoginMutationInput:
    email: str
    password: str


@strawberry.type
class AuthMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, HasSecret])  # type: ignore
    async def login(
        self,
        info: Info[Context, None],
        input: LoginMutationInput,
    ) -> None:
        assert (token_store := info.context.token_store) is not None
        async with info.context.db() as session:
            if (
                user := await session.scalar(
                    select(models.User)
                    .where(models.User.email == input.email)
                    .options(joinedload(models.User.role))
                )
            ) is None or (password_hash := user.password_hash) is None:
                raise Unauthorized(FAILED_LOGIN_MESSAGE)
        secret = info.context.get_secret()
        loop = asyncio.get_running_loop()
        if not await loop.run_in_executor(
            executor=None,
            func=lambda: is_valid_password(
                password=input.password, salt=secret, password_hash=password_hash
            ),
        ):
            raise Unauthorized(FAILED_LOGIN_MESSAGE)
        issued_at = datetime.now(timezone.utc)
        access_token_claims = AccessTokenClaims(
            subject=UserId(user.id),
            issued_at=issued_at,
            expiration_time=issued_at + PHOENIX_ACCESS_TOKEN_MAX_AGE,
            attributes=AccessTokenAttributes(user_role=enums.UserRole(user.role.name)),
        )
        refresh_token_claims = RefreshTokenClaims(
            subject=UserId(user.id),
            issued_at=issued_at,
            expiration_time=issued_at + PHOENIX_REFRESH_TOKEN_MAX_AGE,
            attributes=RefreshTokenAttributes(user_role=enums.UserRole(user.role.name)),
        )
        access_token, _ = await token_store.create_access_token(access_token_claims)
        refresh_token, _ = await token_store.create_refresh_token(refresh_token_claims)
        response = info.context.get_response()
        response.set_cookie(
            key=PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
            value=access_token,
            secure=True,
            httponly=True,
            samesite="strict",
            max_age=int(PHOENIX_ACCESS_TOKEN_MAX_AGE.total_seconds()),
        )
        response.set_cookie(
            key=PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
            value=refresh_token,
            secure=True,
            httponly=True,
            samesite="strict",
            max_age=int(PHOENIX_REFRESH_TOKEN_MAX_AGE.total_seconds()),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsAuthenticated])  # type: ignore
    async def logout(
        self,
        info: Info[Context, None],
    ) -> None:
        assert (token_store := info.context.token_store) is not None
        assert (request := info.context.request)
        assert (user := request.user)
        assert isinstance(user.identity, UserId)
        user_id = int(user.identity)
        token_ids = []
        async with info.context.db() as session:
            async with session.begin_nested():
                for cls in (AccessTokenId, RefreshTokenId):
                    table = cls.table
                    stmt = delete(table).where(table.user_id == user_id).returning(table.id)
                    async for id_ in await session.stream_scalars(stmt):
                        token_ids.append(cls(id_))
        if token_ids:
            await token_store.revoke(*token_ids)
        response = info.context.get_response()
        response.delete_cookie(key=PHOENIX_ACCESS_TOKEN_COOKIE_NAME)
