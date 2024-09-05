import secrets
from contextlib import AsyncExitStack
from datetime import datetime, timezone
from typing import Literal, Optional, Tuple

import strawberry
from sqlalchemy import Select, select
from sqlalchemy.orm import joinedload
from sqlean.dbapi2 import IntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.auth import (
    DEFAULT_SECRET_LENGTH,
    PASSWORD_REQUIREMENTS,
    validate_email_format,
    validate_password_format,
)
from phoenix.db import enums, models
from phoenix.server.api.auth import HasSecret, IsAdmin, IsAuthenticated, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.User import User
from phoenix.server.bearer_auth import PhoenixUser


@strawberry.input
class CreateUserInput:
    email: str
    username: Optional[str] = UNSET
    password: str
    role: UserRoleInput


@strawberry.input
class PatchViewerInput:
    new_username: Optional[str] = UNSET
    new_password: Optional[str] = UNSET
    current_password: Optional[str] = UNSET

    def __post_init__(self) -> None:
        if not self.new_username and not self.new_password:
            raise ValueError("At least one field must be set")
        if self.new_password and not self.current_password:
            raise ValueError("current_password is required when modifying password")
        if self.new_password:
            PASSWORD_REQUIREMENTS.validate(self.new_password)


@strawberry.input
class PatchUserInput:
    user_id: GlobalID
    new_role: Optional[UserRoleInput] = UNSET
    new_username: Optional[str] = UNSET
    new_password: Optional[str] = UNSET
    requester_password: Optional[str] = UNSET

    def __post_init__(self) -> None:
        if not self.new_role and not self.new_username and not self.new_password:
            raise ValueError("At least one field must be set")
        if self.new_password and not self.requester_password:
            raise ValueError("requester_password is required when modifying password")
        if self.new_password:
            PASSWORD_REQUIREMENTS.validate(self.new_password)


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
        user = models.User(
            reset_password=True,
            username=input.username,
            email=email,
            auth_method=enums.AuthMethod.LOCAL.value,
            password_hash=password_hash,
            password_salt=salt,
        )
        async with AsyncExitStack() as stack:
            session = await stack.enter_async_context(info.context.db())
            user_role_id = await session.scalar(_select_role_id_by_name(input.role.value))
            if user_role_id is None:
                raise ValueError(f"Role {input.role.value} not found")
            stack.enter_context(session.no_autoflush)
            user.user_role_id = user_role_id
            session.add(user)
            try:
                await session.flush()
            except IntegrityError as error:
                raise ValueError(_user_operation_error_message(error))
        return UserMutationPayload(
            user=User(
                id_attr=user.id,
                email=user.email,
                username=user.username,
                created_at=user.created_at,
                user_role_id=user.user_role_id,
            )
        )

    @strawberry.mutation(
        permission_classes=[
            IsNotReadOnly,
            HasSecret,
            IsAuthenticated,
            IsAdmin,
        ]
    )  # type: ignore
    async def patch_user(
        self,
        info: Info[Context, None],
        input: PatchUserInput,
    ) -> UserMutationPayload:
        assert (request := info.context.request)
        assert isinstance(request.user, PhoenixUser)
        assert (requester_id := int(request.user.identity))
        user_id = from_global_id_with_expected_type(input.user_id, expected_type_name=User.__name__)
        async with AsyncExitStack() as stack:
            session = await stack.enter_async_context(info.context.db())
            requester = await session.scalar(_select_user_by_id(requester_id))
            assert requester
            if not (user := await session.scalar(_select_user_by_id(user_id))):
                raise ValueError("User not found")
            stack.enter_context(session.no_autoflush)
            if input.new_role:
                user_role_id = await session.scalar(_select_role_id_by_name(input.new_role.value))
                if user_role_id is None:
                    raise ValueError(f"Role {input.new_role.value} not found")
                user.user_role_id = user_role_id
            if password := input.new_password:
                if user.auth_method != enums.AuthMethod.LOCAL.value:
                    raise ValueError("Cannot modify password for non-local user")
                if not (
                    current_password := input.requester_password
                ) or not await info.context.is_valid_password(current_password, requester):
                    raise ValueError("Valid current password is required to modify password")
                validate_password_format(password)
                user.password_salt = secrets.token_bytes(DEFAULT_SECRET_LENGTH)
                user.password_hash = await info.context.hash_password(password, user.password_salt)
                user.reset_password = True
            if username := input.new_username:
                user.username = username
            assert user in session.dirty
            try:
                await session.flush()
            except IntegrityError as error:
                raise ValueError(_user_operation_error_message(error, "modify"))
        assert user
        if input.new_password:
            await info.context.log_out(user.id)
        return UserMutationPayload(
            user=User(
                id_attr=user.id,
                email=user.email,
                username=user.username,
                created_at=user.created_at,
                user_role_id=user.user_role_id,
            )
        )

    @strawberry.mutation(
        permission_classes=[
            IsNotReadOnly,
            HasSecret,
            IsAuthenticated,
        ]
    )  # type: ignore
    async def patch_viewer(
        self,
        info: Info[Context, None],
        input: PatchViewerInput,
    ) -> UserMutationPayload:
        assert (request := info.context.request)
        assert isinstance(user := request.user, PhoenixUser)
        user_id = int(user.identity)
        async with AsyncExitStack() as stack:
            session = await stack.enter_async_context(info.context.db())
            if not (user := await session.scalar(_select_user_by_id(user_id))):
                raise ValueError("User not found")
            stack.enter_context(session.no_autoflush)
            if password := input.new_password:
                if user.auth_method != enums.AuthMethod.LOCAL.value:
                    raise ValueError("Cannot modify password for non-local user")
                if not (
                    current_password := input.current_password
                ) or not await info.context.is_valid_password(current_password, user):
                    raise ValueError("Valid current password is required to modify password")
                validate_password_format(password)
                user.password_salt = secrets.token_bytes(DEFAULT_SECRET_LENGTH)
                user.password_hash = await info.context.hash_password(password, user.password_salt)
                user.reset_password = False
            if username := input.new_username:
                user.username = username
            assert user in session.dirty
            user.updated_at = datetime.now(timezone.utc)
            try:
                await session.flush()
            except IntegrityError as error:
                raise ValueError(_user_operation_error_message(error, "modify"))
        assert user
        if input.new_password:
            await info.context.log_out(user.id)
        return UserMutationPayload(
            user=User(
                id_attr=user.id,
                email=user.email,
                username=user.username,
                created_at=user.created_at,
                user_role_id=user.user_role_id,
            )
        )


def _select_role_id_by_name(role_name: str) -> Select[Tuple[int]]:
    return select(models.UserRole.id).where(models.UserRole.name == role_name)


def _select_user_by_id(user_id: int) -> Select[Tuple[models.User]]:
    return (
        select(models.User).where(models.User.id == user_id).options(joinedload(models.User.role))
    )


def _user_operation_error_message(
    error: IntegrityError,
    operation: Literal["create", "modify"] = "create",
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
    return f"Failed to {operation} user"
