import strawberry
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import HasSecret, IsAuthenticated, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.types import (
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
        async with info.context.db() as session:
            if (
                user := await session.scalar(
                    select(models.User)
                    .where(models.User.email == input.email)
                    .options(joinedload(models.User.role))
                )
            ) is None or (hash_ := user.password_hash) is None:
                raise Unauthorized(FAILED_LOGIN_MESSAGE)
        assert (salt := user.password_salt) is not None
        if not await info.context.is_valid_password(input.password, hash_, salt=salt):
            raise Unauthorized(FAILED_LOGIN_MESSAGE)
        await info.context.log_out(user.id)
        await info.context.log_in(user)

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsAuthenticated])  # type: ignore
    async def logout(
        self,
        info: Info[Context, None],
    ) -> None:
        assert (request := info.context.request)
        assert (user := request.user)
        assert isinstance(user_id := user.identity, UserId)
        await info.context.log_out(int(user_id))
