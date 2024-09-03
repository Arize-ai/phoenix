import secrets
from typing import Literal, Optional

import strawberry
from sqlalchemy import select
from sqlean.dbapi2 import IntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.types import Info

from phoenix.auth import (
    DEFAULT_SECRET_LENGTH,
    validate_email_format,
    validate_password_format,
)
from phoenix.db import enums, models
from phoenix.server.api.auth import HasSecret, IsAdmin, IsAuthenticated, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from phoenix.server.api.types.User import User


@strawberry.input
class CreateUserInput:
    email: str
    password: str
    role: UserRoleInput
    username: Optional[str] = UNSET


@strawberry.type
class UserMutationPayload:
    user: User


@strawberry.type
class UserMutationMixin:
    @strawberry.mutation(
        permission_classes=[
            IsNotReadOnly,
            HasSecret,
            IsAuthenticated,
            IsAdmin,
        ]
    )  # type: ignore
    async def create_user(
        self,
        info: Info[Context, None],
        input: CreateUserInput,
    ) -> UserMutationPayload:
        validate_email_format(email := input.email)
        validate_password_format(password := input.password)
        salt = secrets.token_bytes(DEFAULT_SECRET_LENGTH)
        password_hash = await info.context.hash_password(password, salt)
        async with info.context.db() as session:
            user_role_id = await session.scalar(
                select(models.UserRole.id).where(models.UserRole.name == input.role.value)
            )
            if user_role_id is None:
                raise ValueError(f"Role {input.role.value} not found")
            user = models.User(
                user_role_id=user_role_id,
                username=input.username or None,
                email=email,
                auth_method=enums.AuthMethod.LOCAL.value,
                password_hash=password_hash,
                password_salt=salt,
                reset_password=True,
            )
            session.add(user)
            try:
                await session.flush()
            except IntegrityError as error:
                raise ValueError(_user_error_message(error))
        return UserMutationPayload(
            user=User(
                id_attr=user.id,
                email=user.email,
                username=user.username,
                created_at=user.created_at,
                user_role_id=user.user_role_id,
            )
        )


def _user_error_message(
    error: IntegrityError,
    action: Literal["create", "modify"] = "create",
) -> str:
    """
    User-facing error message to explain why user creation/modification failed.
    """
    original_error_message = str(error)
    username_already_exists = "users.username" in original_error_message
    email_already_exists = "users.email" in original_error_message
    if username_already_exists:
        return "Username already exists"
    elif email_already_exists:
        return "Email already exists"
    return f"Failed to {action} user"
