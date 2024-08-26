import asyncio
from datetime import datetime, timezone

import strawberry
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from starlette.requests import Request
from strawberry.types import Info

from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_COOKIE_MAX_AGE,
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    Claim,
    Issuer,
    SessionAttributes,
    is_valid_password,
)
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.mutations.auth import HasSecret, IsAuthenticated, IsNotReadOnly

FAILED_LOGIN_MESSAGE = "login failed"


@strawberry.input
class LoginMutationInput:
    email: str
    password: str


@strawberry.type
class AuthMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, HasSecret, IsNotReadOnly])  # type: ignore
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
                    .options(selectinload(models.User.role))
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
        claim = Claim(
            issuer=Issuer.SESSION,
            user_id=user.id,
            expiration_time=datetime.now(timezone.utc) + PHOENIX_ACCESS_TOKEN_COOKIE_MAX_AGE,
            attributes=SessionAttributes(user_role=user.role.name),
        )
        value, _ = await token_store.create(claim)
        response = info.context.get_response()
        response.set_cookie(
            key=PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
            value=value,
            secure=True,
            httponly=True,
            samesite="strict",
            max_age=int(PHOENIX_ACCESS_TOKEN_COOKIE_MAX_AGE.total_seconds()),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, HasSecret, IsNotReadOnly, IsAuthenticated]
    )  # type: ignore
    async def logout(
        self,
        info: Info[Context, None],
    ) -> None:
        assert (token_store := info.context.token_store) is not None
        if (
            isinstance(request := info.context.request, Request)
            and request.cookies
            and (token := request.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
        ):
            await token_store.revoke(token)
        response = info.context.get_response()
        response.delete_cookie(key=PHOENIX_ACCESS_TOKEN_COOKIE_NAME)
