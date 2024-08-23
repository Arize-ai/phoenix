import asyncio
from datetime import timedelta

import strawberry
from sqlalchemy import select
from strawberry.types import Info

from phoenix.auth import is_valid_password
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.mutations.auth import HasSecret

PHOENIX_ACCESS_TOKEN_COOKIE_NAME = "phoenix-access-token"
PHOENIX_ACCESS_TOKEN_COOKIE_MAX_AGE_IN_SECONDS = int(timedelta(days=31).total_seconds())
FAILED_LOGIN_MESSAGE = "login failed"


@strawberry.input
class LoginMutationInput:
    email: str
    password: str


@strawberry.type
class AuthMutationMixin:
    @strawberry.mutation(permission_classes=[HasSecret])  # type: ignore
    async def login(
        self,
        info: Info[Context, None],
        input: LoginMutationInput,
    ) -> None:
        async with info.context.db() as session:
            if (
                user := await session.scalar(
                    select(models.User).where(models.User.email == input.email)
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
        response = info.context.get_response()
        response.set_cookie(
            key=PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
            value="token",  # todo: compute access token
            secure=True,
            httponly=True,
            samesite="strict",
            max_age=PHOENIX_ACCESS_TOKEN_COOKIE_MAX_AGE_IN_SECONDS,
        )

    @strawberry.mutation(permission_classes=[HasSecret])  # type: ignore
    async def logout(
        self,
        info: Info[Context, None],
    ) -> None:
        response = info.context.get_response()
        response.delete_cookie(key=PHOENIX_ACCESS_TOKEN_COOKIE_NAME)
