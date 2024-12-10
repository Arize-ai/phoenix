import secrets
from contextlib import AsyncExitStack
from datetime import datetime, timezone
from typing import Literal, Optional

import strawberry
from sqlalchemy import Boolean, Select, and_, case, cast, delete, distinct, func, select
from sqlalchemy.orm import joinedload
from sqlean.dbapi2 import IntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.auth import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_SECRET_LENGTH,
    PASSWORD_REQUIREMENTS,
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
    validate_email_format,
    validate_password_format,
)
from phoenix.db import enums, models
from phoenix.server.api.auth import IsAdmin, IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import Conflict, NotFound, Unauthorized
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.User import User, to_gql_user
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.types import AccessTokenId, ApiKeyId, PasswordResetTokenId, RefreshTokenId


@strawberry.input
class CreateUserInput:
    email: str
    username: str
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

    def __post_init__(self) -> None:
        if not self.new_role and not self.new_username and not self.new_password:
            raise ValueError("At least one field must be set")
        if self.new_password:
            PASSWORD_REQUIREMENTS.validate(self.new_password)


@strawberry.input
class DeleteUsersInput:
    user_ids: list[GlobalID]


@strawberry.type
class UserMutationPayload:
    user: User


@strawberry.type
class UserMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsAdmin, IsLocked])  # type: ignore
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
            password_hash=password_hash,
            password_salt=salt,
        )
        async with AsyncExitStack() as stack:
            session = await stack.enter_async_context(info.context.db())
            user_role_id = await session.scalar(_select_role_id_by_name(input.role.value))
            if user_role_id is None:
                raise NotFound(f"Role {input.role.value} not found")
            stack.enter_context(session.no_autoflush)
            user.user_role_id = user_role_id
            session.add(user)
            try:
                await session.flush()
            except IntegrityError as error:
                raise Conflict(_user_operation_error_message(error))
        return UserMutationPayload(user=to_gql_user(user))

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsAdmin, IsLocked])  # type: ignore
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
                raise NotFound("User not found")
            stack.enter_context(session.no_autoflush)
            if input.new_role:
                if user.email == DEFAULT_ADMIN_EMAIL:
                    raise Unauthorized("Cannot modify role for the default admin user")
                user_role_id = await session.scalar(_select_role_id_by_name(input.new_role.value))
                if user_role_id is None:
                    raise NotFound(f"Role {input.new_role.value} not found")
                user.user_role_id = user_role_id
            if password := input.new_password:
                if user.auth_method != enums.AuthMethod.LOCAL.value:
                    raise Conflict("Cannot modify password for non-local user")
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
                raise Conflict(_user_operation_error_message(error, "modify"))
        assert user
        if input.new_password:
            await info.context.log_out(user.id)
        return UserMutationPayload(user=to_gql_user(user))

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
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
                raise NotFound("User not found")
            stack.enter_context(session.no_autoflush)
            if password := input.new_password:
                if user.auth_method != enums.AuthMethod.LOCAL.value:
                    raise Conflict("Cannot modify password for non-local user")
                if not (
                    current_password := input.current_password
                ) or not await info.context.is_valid_password(current_password, user):
                    raise Conflict("Valid current password is required to modify password")
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
                raise Conflict(_user_operation_error_message(error, "modify"))
        assert user
        if input.new_password:
            await info.context.log_out(user.id)
            response = info.context.get_response()
            response.delete_cookie(PHOENIX_REFRESH_TOKEN_COOKIE_NAME)
            response.delete_cookie(PHOENIX_ACCESS_TOKEN_COOKIE_NAME)
        return UserMutationPayload(user=to_gql_user(user))

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsAdmin, IsLocked])  # type: ignore
    async def delete_users(
        self,
        info: Info[Context, None],
        input: DeleteUsersInput,
    ) -> None:
        assert (token_store := info.context.token_store) is not None
        if not input.user_ids:
            return
        user_ids = tuple(
            map(
                lambda gid: from_global_id_with_expected_type(gid, User.__name__),
                set(input.user_ids),
            )
        )
        system_user_role_id = (
            select(models.UserRole.id)
            .where(models.UserRole.name == enums.UserRole.SYSTEM.value)
            .scalar_subquery()
        )
        admin_user_role_id = (
            select(models.UserRole.id)
            .where(models.UserRole.name == enums.UserRole.ADMIN.value)
            .scalar_subquery()
        )
        default_admin_user_id = (
            select(models.User.id)
            .where(
                (
                    and_(
                        models.User.user_role_id == admin_user_role_id,
                        models.User.username == DEFAULT_ADMIN_USERNAME,
                        models.User.email == DEFAULT_ADMIN_EMAIL,
                    )
                )
            )
            .scalar_subquery()
        )
        async with info.context.db() as session:
            [
                (
                    deletes_default_admin,
                    num_resolved_user_ids,
                )
            ] = (
                await session.execute(
                    select(
                        cast(
                            func.coalesce(
                                func.max(
                                    case((models.User.id == default_admin_user_id, 1), else_=0)
                                ),
                                0,
                            ),
                            Boolean,
                        ).label("deletes_default_admin"),
                        func.count(distinct(models.User.id)).label("num_resolved_user_ids"),
                    )
                    .select_from(models.User)
                    .where(
                        and_(
                            models.User.id.in_(user_ids),
                            models.User.user_role_id != system_user_role_id,
                        )
                    )
                )
            ).all()
            if deletes_default_admin:
                raise Conflict("Cannot delete the default admin user")
            if num_resolved_user_ids < len(user_ids):
                raise NotFound("Some user IDs could not be found")
            password_reset_token_ids = [
                PasswordResetTokenId(id_)
                async for id_ in await session.stream_scalars(
                    select(models.PasswordResetToken.id).where(
                        models.PasswordResetToken.user_id.in_(user_ids)
                    )
                )
            ]
            access_token_ids = [
                AccessTokenId(id_)
                async for id_ in await session.stream_scalars(
                    select(models.AccessToken.id).where(models.AccessToken.user_id.in_(user_ids))
                )
            ]
            refresh_token_ids = [
                RefreshTokenId(id_)
                async for id_ in await session.stream_scalars(
                    select(models.RefreshToken.id).where(models.RefreshToken.user_id.in_(user_ids))
                )
            ]
            api_key_ids = [
                ApiKeyId(id_)
                async for id_ in await session.stream_scalars(
                    select(models.ApiKey.id).where(models.ApiKey.user_id.in_(user_ids))
                )
            ]
            await session.execute(delete(models.User).where(models.User.id.in_(user_ids)))
        await token_store.revoke(
            *password_reset_token_ids,
            *access_token_ids,
            *refresh_token_ids,
            *api_key_ids,
        )


def _select_role_id_by_name(role_name: str) -> Select[tuple[int]]:
    return select(models.UserRole.id).where(models.UserRole.name == role_name)


def _select_user_by_id(user_id: int) -> Select[tuple[models.User]]:
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
