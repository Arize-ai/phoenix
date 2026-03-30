import asyncio
import logging
import secrets
from datetime import datetime, timezone
from functools import partial
from typing import Annotated, Literal, Union

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from pydantic import Field, model_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.orm import joinedload
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from starlette.datastructures import Secret
from strawberry.relay import GlobalID
from typing_extensions import Self, TypeAlias, assert_never

from phoenix.auth import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_SECRET_LENGTH,
    DEFAULT_SYSTEM_EMAIL,
    DEFAULT_SYSTEM_USERNAME,
    compute_password_hash,
    is_valid_password,
    sanitize_email,
    validate_email_format,
    validate_password_format,
)
from phoenix.config import get_env_disable_basic_auth
from phoenix.db import models
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    add_errors_to_responses,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.authorization import is_not_locked, require_admin
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.types import UserId

logger = logging.getLogger(__name__)

router = APIRouter(tags=["users"])


class UserData(V1RoutesBaseModel):
    email: str
    username: str
    role: models.UserRoleName


class LocalUserData(UserData):
    auth_method: Literal["LOCAL"]
    password: str = UNDEFINED


class OAuth2UserData(UserData):
    auth_method: Literal["OAUTH2"]
    oauth2_client_id: str = UNDEFINED
    oauth2_user_id: str = UNDEFINED


class LDAPUserData(UserData):
    auth_method: Literal["LDAP"]


class DbUser(V1RoutesBaseModel):
    id: str
    created_at: datetime
    updated_at: datetime


class LocalUser(LocalUserData, DbUser):
    password_needs_reset: bool


class OAuth2User(OAuth2UserData, DbUser):
    profile_picture_url: str = UNDEFINED


class LDAPUser(LDAPUserData, DbUser):
    pass


User: TypeAlias = Annotated[
    Union[LocalUser, OAuth2User, LDAPUser], Field(..., discriminator="auth_method")
]


class AnonymousUser(V1RoutesBaseModel):
    auth_method: Literal["ANONYMOUS"]


ViewerUser: TypeAlias = Annotated[
    Union[LocalUser, OAuth2User, LDAPUser, AnonymousUser],
    Field(..., discriminator="auth_method"),
]


class GetUsersResponseBody(PaginatedResponseBody[User]):
    pass


class GetUserResponseBody(ResponseBody[User]):
    pass


class GetViewerResponseBody(ResponseBody[ViewerUser]):
    pass


class CreateUserRequestBody(V1RoutesBaseModel):
    user: Annotated[
        Union[LocalUserData, OAuth2UserData, LDAPUserData], Field(..., discriminator="auth_method")
    ]
    send_welcome_email: bool = True


class CreateUserResponseBody(ResponseBody[User]):
    pass


class PatchUserRequestBody(V1RoutesBaseModel):
    """Fields to update. At least one must be provided."""

    username: str | None = None
    password: str | None = None
    current_password: str | None = None
    role: models.UserRoleName | None = None

    @model_validator(mode="after")
    def _at_least_one_field(self) -> Self:
        if self.username is None and self.password is None and self.role is None:
            raise ValueError("At least one field must be set")
        return self


DEFAULT_PAGINATION_PAGE_LIMIT = 100


def _db_user_to_response(user: models.User) -> User:
    """Convert a database User model to a REST API User response."""
    global_id = str(GlobalID("User", str(user.id)))
    if isinstance(user, models.LocalUser):
        return LocalUser(
            id=global_id,
            username=user.username,
            email=user.email,
            role=user.role.name,
            created_at=user.created_at,
            updated_at=user.updated_at,
            auth_method="LOCAL",
            password_needs_reset=user.reset_password,
        )
    elif isinstance(user, models.LDAPUser):
        return LDAPUser(
            id=global_id,
            username=user.username,
            email=user.email or "",
            role=user.role.name,
            created_at=user.created_at,
            updated_at=user.updated_at,
            auth_method="LDAP",
        )
    elif isinstance(user, models.OAuth2User):
        oauth2_user = OAuth2User(
            id=global_id,
            username=user.username,
            email=user.email,
            role=user.role.name,
            created_at=user.created_at,
            updated_at=user.updated_at,
            auth_method="OAUTH2",
        )
        if user.oauth2_client_id:
            oauth2_user.oauth2_client_id = user.oauth2_client_id
        if user.oauth2_user_id:
            oauth2_user.oauth2_user_id = user.oauth2_user_id
        if user.profile_picture_url:
            oauth2_user.profile_picture_url = user.profile_picture_url
        return oauth2_user
    raise ValueError(f"Unknown user type: {type(user)}")


@router.get(
    "/user",
    operation_id="getViewer",
    summary="Get the authenticated user",
    description=(
        "Returns the profile of the currently authenticated user. "
        "When authentication is disabled, returns an anonymous user representation."
    ),
    response_description="The authenticated user's profile.",
    responses=add_errors_to_responses(
        [
            {"status_code": 401, "description": "User not found."},
        ],
    ),
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def get_viewer(
    request: Request,
) -> GetViewerResponseBody:
    if not request.app.state.authentication_enabled:
        return GetViewerResponseBody(data=AnonymousUser(auth_method="ANONYMOUS"))
    if not isinstance(request.user, PhoenixUser):
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = int(request.user.identity)
    async with request.app.state.db() as session:
        user = await session.scalar(
            select(models.User).options(joinedload(models.User.role)).filter_by(id=user_id)
        )
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return GetViewerResponseBody(data=_db_user_to_response(user))


@router.get(
    "/users",
    operation_id="getUsers",
    summary="List all users",
    description="Retrieve a paginated list of all users in the system.",
    response_description="A list of users.",
    responses=add_errors_to_responses(
        [
            422,
        ],
    ),
    dependencies=[Depends(require_admin)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def list_users(
    request: Request,
    cursor: str = Query(default=None, description="Cursor for pagination (base64-encoded user ID)"),
    limit: int = Query(
        default=DEFAULT_PAGINATION_PAGE_LIMIT,
        description="The max number of users to return at a time.",
        gt=0,
    ),
) -> GetUsersResponseBody:
    stmt = select(models.User).options(joinedload(models.User.role)).order_by(models.User.id.desc())
    if cursor:
        try:
            cursor_id = GlobalID.from_id(cursor).node_id
        except Exception:
            raise HTTPException(status_code=422, detail=f"Invalid cursor format: {cursor}")
        else:
            stmt = stmt.where(models.User.id <= int(cursor_id))
    stmt = stmt.limit(limit + 1)
    async with request.app.state.db() as session:
        result = (await session.scalars(stmt)).all()
    next_cursor = None
    if len(result) == limit + 1:
        last_user = result[-1]
        next_cursor = str(GlobalID("User", str(last_user.id)))
        result = result[:-1]
    data: list[User] = [_db_user_to_response(user) for user in result]
    return GetUsersResponseBody(next_cursor=next_cursor, data=data)


@router.post(
    "/users",
    operation_id="createUser",
    summary="Create a new user",
    description="Create a new user with the specified configuration.",
    response_description="The newly created user.",
    status_code=201,
    responses=add_errors_to_responses(
        [
            {"status_code": 400, "description": "Role not found."},
            {"status_code": 409, "description": "Username or email already exists."},
            422,
        ]
    ),
    dependencies=[Depends(require_admin), Depends(is_not_locked)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def create_user(
    request: Request,
    request_body: CreateUserRequestBody,
) -> CreateUserResponseBody:
    user_data = request_body.user
    email, username, role = user_data.email, user_data.username, user_data.role
    # Sanitize email by trimming and lowercasing
    email = sanitize_email(email)
    validate_email_format(email)

    # Prevent creation of SYSTEM users
    if role == "SYSTEM":
        raise HTTPException(
            status_code=400,
            detail="Cannot create users with SYSTEM role",
        )

    user: models.User
    if isinstance(user_data, LocalUserData):
        password = (user_data.password or secrets.token_hex()).strip()
        validate_password_format(password)

        # Generate salt and hash password using the same method as in context.py
        salt = secrets.token_bytes(DEFAULT_SECRET_LENGTH)
        compute = partial(compute_password_hash, password=Secret(password), salt=salt)
        password_hash = await asyncio.get_running_loop().run_in_executor(None, compute)

        user = models.LocalUser(
            email=email,
            username=username,
            password_hash=password_hash,
            password_salt=salt,
            reset_password=True,
        )
    elif isinstance(user_data, OAuth2UserData):
        user = models.OAuth2User(
            email=email,
            username=username,
            oauth2_client_id=user_data.oauth2_client_id or None,
            oauth2_user_id=user_data.oauth2_user_id or None,
        )
    elif isinstance(user_data, LDAPUserData):
        user = models.LDAPUser(
            email=email,
            username=username,
        )
    else:
        assert_never(user_data)
    try:
        async with request.app.state.db() as session:
            user_role_id = await session.scalar(select(models.UserRole.id).filter_by(name=role))
            if user_role_id is None:
                raise HTTPException(status_code=400, detail=f"Role '{role}' not found")
            user.user_role_id = user_role_id
            session.add(user)
            await session.flush()
            await session.refresh(user, ["role"])
            data = _db_user_to_response(user)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
        if "users.username" in str(e):
            raise HTTPException(status_code=409, detail="Username already exists")
        elif "users.email" in str(e):
            raise HTTPException(status_code=409, detail="Email already exists")
        else:
            raise HTTPException(
                status_code=409,
                detail="Failed to create user due to a conflict with existing data",
            )
    # Send welcome email if requested
    if (
        request_body.send_welcome_email
        and request.app.state.email_sender is not None
        and user.email
    ):
        try:
            await request.app.state.email_sender.send_welcome_email(user.email, user.username)
        except Exception as error:
            # Log the error but do not raise it
            logger.error(f"Failed to send welcome email: {error}")
    return CreateUserResponseBody(data=data)


@router.patch(
    "/users/{user_id}",
    operation_id="patchUser",
    summary="Update a user by ID",
    description=(
        "Partially update a user. Admins may update another user's role, username, and password. "
        "Any authenticated user may update their own username and password; "
        "changing your own password requires the current password."
    ),
    response_description="The updated user.",
    responses=add_errors_to_responses(
        [
            {"status_code": 400, "description": "Invalid request (e.g. role not found)."},
            {"status_code": 401, "description": "Not authenticated."},
            {
                "status_code": 403,
                "description": "Forbidden (e.g. not admin, or invalid self-update).",
            },
            {"status_code": 404, "description": "User not found."},
            {
                "status_code": 409,
                "description": "Conflict (e.g. username exists, invalid password).",
            },
            422,
        ]
    ),
    dependencies=[Depends(is_not_locked)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def patch_user(
    request: Request,
    request_body: PatchUserRequestBody,
    user_id: str = Path(..., description="The GlobalID of the user."),
) -> GetUserResponseBody:
    try:
        target_id = from_global_id_with_expected_type(GlobalID.from_id(user_id), "User")
    except Exception:
        raise HTTPException(status_code=422, detail=f"Invalid User GlobalID format: {user_id}")

    auth_enabled = request.app.state.authentication_enabled
    if auth_enabled:
        if not isinstance(request.user, PhoenixUser):
            raise HTTPException(status_code=401, detail="Not authenticated")
        requester_id = int(request.user.identity)
        is_admin = request.user.is_admin
        is_self = requester_id == target_id
        if not is_self and not is_admin:
            raise HTTPException(
                status_code=403,
                detail="Only admin or system users can perform this action.",
            )
    else:
        is_self = False

    if request_body.role is not None and auth_enabled and is_self:
        raise HTTPException(status_code=403, detail="Cannot modify own role")

    if request_body.password is not None and get_env_disable_basic_auth():
        raise HTTPException(
            status_code=400,
            detail="Basic auth is disabled: OAuth2 authentication only",
        )

    if (
        auth_enabled
        and is_self
        and request_body.password is not None
        and not request_body.current_password
    ):
        raise HTTPException(
            status_code=400,
            detail="current_password is required when modifying password",
        )

    should_log_out = False

    async with request.app.state.db() as session:
        user = await session.scalar(
            select(models.User)
            .options(joinedload(models.User.role))
            .where(models.User.id == target_id)
        )
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")

        if request_body.role is not None:
            if user.email == DEFAULT_ADMIN_EMAIL:
                raise HTTPException(
                    status_code=403,
                    detail="Cannot modify role for the default admin user",
                )
            user_role_id = await session.scalar(
                select(models.UserRole.id).filter_by(name=request_body.role)
            )
            if user_role_id is None:
                raise HTTPException(status_code=400, detail=f"Role '{request_body.role}' not found")
            user.user_role_id = user_role_id
            should_log_out = True

        if request_body.password is not None:
            if user.auth_method != "LOCAL":
                raise HTTPException(
                    status_code=409,
                    detail="Cannot modify password for non local user",
                )
            assert isinstance(user, models.LocalUser)
            validate_password_format(request_body.password)
            salt = secrets.token_bytes(DEFAULT_SECRET_LENGTH)
            compute = partial(
                compute_password_hash,
                password=Secret(request_body.password),
                salt=salt,
            )
            password_hash = await asyncio.get_running_loop().run_in_executor(None, compute)
            if auth_enabled and is_self:
                if request_body.current_password is None:
                    raise HTTPException(
                        status_code=400,
                        detail="current_password is required when modifying password",
                    )
                current_salt = user.password_salt
                current_password_hash = user.password_hash
                if current_salt is None or current_password_hash is None:
                    raise HTTPException(
                        status_code=500,
                        detail="Local user missing password credentials",
                    )
                if not is_valid_password(
                    password=Secret(request_body.current_password),
                    salt=current_salt,
                    password_hash=current_password_hash,
                ):
                    raise HTTPException(
                        status_code=409,
                        detail="Valid current password is required to modify password",
                    )
                user.reset_password = False
                should_log_out = True
            else:
                user.reset_password = True
                should_log_out = True
            user.password_salt = salt
            user.password_hash = password_hash

        if request_body.username is not None:
            user.username = request_body.username

        user.updated_at = datetime.now(timezone.utc)

        try:
            await session.flush()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            if "users.username" in str(e):
                raise HTTPException(status_code=409, detail="Username already exists")
            if "users.email" in str(e):
                raise HTTPException(status_code=409, detail="Email already exists")
            raise HTTPException(status_code=409, detail="Failed to modify user")

        await session.refresh(user, ["role"])
        data = _db_user_to_response(user)

    if should_log_out and (token_store := getattr(request.app.state, "_token_store", None)):
        await token_store.log_out(UserId(target_id))

    return GetUserResponseBody(data=data)


@router.delete(
    "/users/{user_id}",
    operation_id="deleteUser",
    summary="Delete a user by ID",
    description="Delete an existing user by their unique GlobalID.",
    response_description="No content returned on successful deletion.",
    status_code=204,
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "User not found."},
            422,
            {
                "status_code": 403,
                "description": "Cannot delete the default admin or system user",
            },
        ]
    ),
    dependencies=[Depends(require_admin)],
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def delete_user(
    request: Request,
    user_id: str = Path(..., description="The GlobalID of the user (e.g. 'VXNlcjox')."),
) -> None:
    try:
        id_ = from_global_id_with_expected_type(GlobalID.from_id(user_id), "User")
    except Exception:
        raise HTTPException(status_code=422, detail=f"Invalid User GlobalID format: {user_id}")
    async with request.app.state.db() as session:
        user = await session.get(models.User, id_)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        # Prevent deletion of system and default admin users
        if (
            user.email == DEFAULT_ADMIN_EMAIL
            or user.email == DEFAULT_SYSTEM_EMAIL
            or user.username == DEFAULT_ADMIN_USERNAME
            or user.username == DEFAULT_SYSTEM_USERNAME
        ):
            raise HTTPException(
                status_code=403, detail="Cannot delete the default admin or system user"
            )
        await session.delete(user)
    return None
