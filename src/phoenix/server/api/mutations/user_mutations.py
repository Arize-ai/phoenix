import asyncio
from typing import Optional

import strawberry
from sqlalchemy import insert, select
from sqlean.dbapi2 import IntegrityError  # type: ignore[import-untyped]
from strawberry.types import Info

from phoenix.auth import compute_password_hash, validate_email_format, validate_password_format
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from phoenix.server.api.types.User import User
from phoenix.server.api.types.UserRole import UserRole


@strawberry.input
class CreateUserInput:
    email: str
    username: Optional[str]
    password: str
    role: UserRoleInput


@strawberry.type
class UserMutationPayload:
    user: User


@strawberry.type
class UserMutationMixin:
    @strawberry.mutation
    async def create_user(
        self,
        info: Info[Context, None],
        input: CreateUserInput,
    ) -> UserMutationPayload:
        validate_email_format(email := input.email)
        validate_password_format(password := input.password)
        role_name = input.role.value
        user_role_id = (
            select(models.UserRole.id).where(models.UserRole.name == role_name).scalar_subquery()
        )
        secret = info.context.get_secret()
        loop = asyncio.get_running_loop()
        password_hash = await loop.run_in_executor(
            executor=None,
            func=lambda: compute_password_hash(password=password, salt=secret),
        )
        try:
            async with info.context.db() as session:
                user = await session.scalar(
                    insert(models.User)
                    .values(
                        user_role_id=user_role_id,
                        username=input.username,
                        email=email,
                        auth_method="LOCAL",
                        password_hash=password_hash,
                        reset_password=True,
                    )
                    .returning(models.User)
                )
            assert user is not None
        except IntegrityError as error:
            raise ValueError(_get_user_create_error_message(error))
        return UserMutationPayload(
            user=User(
                id_attr=user.id,
                email=user.email,
                username=user.username,
                created_at=user.created_at,
                role=UserRole(id_attr=user.user_role_id, name=role_name),
            )
        )


def _get_user_create_error_message(error: IntegrityError) -> str:
    """
    Gets a user-facing error message to explain why user creation failed.
    """
    original_error_message = str(error)
    username_already_exists = "users.username" in original_error_message
    email_already_exists = "users.email" in original_error_message
    if username_already_exists:
        return "Username already exists"
    elif email_already_exists:
        return "Email already exists"
    return "Failed to create user"
