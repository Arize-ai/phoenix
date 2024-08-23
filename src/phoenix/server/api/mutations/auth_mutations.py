import asyncio
from datetime import timedelta

import strawberry
from sqlalchemy import select
from strawberry.types import Info

from phoenix.auth import is_valid_password
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.mutations.auth import HasSecret

PHOENIX_ACCESS_TOKEN_COOKIE_NAME = "phoenix-access-token"
PHOENIX_ACCESS_TOKEN_COOKIE_MAX_AGE_IN_SECONDS = int(timedelta(days=31).total_seconds())


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
        # This is written to avoid an information disclosure vulnerability. In
        # the event of a failed login, the stacktrace should not reveal whether
        # login failed because of a non-existent email or an incorrect password.
        # This is a workaround until we improve our error logging to prevent
        # sensitive stacktraces from being logged.
        # https://github.com/Arize-ai/phoenix/issues/4335
        login_failed = False
        async with info.context.db() as session:
            if (
                user := await session.scalar(
                    select(models.User).where(models.User.email == input.email)
                )
            ) is None or (password_hash := user.password_hash) is None:
                login_failed = True
        if not login_failed:
            secret = info.context.get_secret()
            loop = asyncio.get_running_loop()
            if not await loop.run_in_executor(
                executor=None,
                func=lambda: is_valid_password(
                    password=input.password, salt=secret, password_hash=password_hash
                ),
            ):
                login_failed = True
        if login_failed:
            raise ValueError("login failed")
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
