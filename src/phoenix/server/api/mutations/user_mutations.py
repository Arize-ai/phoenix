from typing import Optional

import strawberry
from sqlalchemy import insert, select
from sqlean.dbapi2 import IntegrityError
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
        validate_email_format(input.email)
        validate_password_format(input.password)
        role_name = input.role.value
        user_role_id = (
            select(models.UserRole.id).where(models.UserRole.name == role_name).scalar_subquery()
        )
        password_hash = compute_password_hash(input.password)
        async with info.context.db() as session:
            try:
                user = await session.scalar(
                    insert(models.User)
                    .values(
                        user_role_id=user_role_id,
                        username=input.username,
                        email=input.email,
                        auth_method="LOCAL",
                        password_hash=password_hash,
                        reset_password=True,
                    )
                    .returning(models.User)
                )
            except IntegrityError as error:
                _handle_integrity_error(error)
            return UserMutationPayload(
                user=User(
                    id_attr=user.id,
                    email=user.email,
                    username=user.username,
                    created_at=user.created_at,
                    role=UserRole(id_attr=user.user_role_id, name=role_name),
                )
            )


def _handle_integrity_error(error: IntegrityError) -> None:
    """
    Raise an error to report which unique constraint has been violated when
    creating a user.
    """
    original_error_message = str(error)
    username_already_exists = "users.username" in original_error_message
    email_already_exists = "users.email" in original_error_message
    if username_already_exists:
        error_message = "Username already exists"
    elif email_already_exists:
        error_message = "Email already exists"
    else:
        error_message = "Failed to create user"
    raise ValueError(error_message)
