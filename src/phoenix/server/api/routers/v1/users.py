import asyncio
import logging
import secrets
from datetime import datetime
from functools import partial
from typing import Annotated, Literal, Union

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.orm import joinedload
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from starlette.datastructures import Secret
from starlette.status import (
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
    HTTP_422_UNPROCESSABLE_ENTITY,
)
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias, assert_never

from phoenix.auth import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_SECRET_LENGTH,
    DEFAULT_SYSTEM_EMAIL,
    DEFAULT_SYSTEM_USERNAME,
    compute_password_hash,
    validate_email_format,
    validate_password_format,
)
from phoenix.db import models
from phoenix.db.types.db_models import UNDEFINED
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    add_errors_to_responses,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.authorization import is_not_locked, require_admin

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


class DbUser(V1RoutesBaseModel):
    id: str
    created_at: datetime
    updated_at: datetime


class LocalUser(LocalUserData, DbUser):
    password_needs_reset: bool


class OAuth2User(OAuth2UserData, DbUser):
    profile_picture_url: str = UNDEFINED


User: TypeAlias = Annotated[Union[LocalUser, OAuth2User], Field(..., discriminator="auth_method")]


class GetUsersResponseBody(PaginatedResponseBody[User]):
    pass


class GetUserResponseBody(ResponseBody[User]):
    pass


class CreateUserRequestBody(V1RoutesBaseModel):
    user: Annotated[Union[LocalUserData, OAuth2UserData], Field(..., discriminator="auth_method")]
    send_welcome_email: bool = True


class CreateUserResponseBody(ResponseBody[User]):
    pass


DEFAULT_PAGINATION_PAGE_LIMIT = 100


@router.get(
    "/users",
    operation_id="getUsers",
    summary="List all users",
    description="Retrieve a paginated list of all users in the system.",
    response_description="A list of users.",
    responses=add_errors_to_responses(
        [
            HTTP_422_UNPROCESSABLE_ENTITY,
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
    data: list[User] = []
    for user in result:
        if isinstance(user, models.LocalUser):
            data.append(
                LocalUser(
                    id=str(GlobalID("User", str(user.id))),
                    username=user.username,
                    email=user.email,
                    role=user.role.name,
                    created_at=user.created_at,
                    updated_at=user.updated_at,
                    auth_method="LOCAL",
                    password_needs_reset=user.reset_password,
                )
            )
        elif isinstance(user, models.OAuth2User):
            oauth2_user = OAuth2User(
                id=str(GlobalID("User", str(user.id))),
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
            data.append(oauth2_user)
    return GetUsersResponseBody(next_cursor=next_cursor, data=data)


@router.post(
    "/users",
    operation_id="createUser",
    summary="Create a new user",
    description="Create a new user with the specified configuration.",
    response_description="The newly created user.",
    status_code=HTTP_201_CREATED,
    responses=add_errors_to_responses(
        [
            {"status_code": HTTP_400_BAD_REQUEST, "description": "Role not found."},
            {"status_code": HTTP_409_CONFLICT, "description": "Username or email already exists."},
            HTTP_422_UNPROCESSABLE_ENTITY,
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
    validate_email_format(email)

    # Prevent creation of SYSTEM users
    if role == "SYSTEM":
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
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
    else:
        assert_never(user_data)
    try:
        async with request.app.state.db() as session:
            user_role_id = await session.scalar(select(models.UserRole.id).filter_by(name=role))
            if user_role_id is None:
                raise HTTPException(status_code=400, detail=f"Role '{role}' not found")
            user.user_role_id = user_role_id
            session.add(user)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
        if "users.username" in str(e):
            raise HTTPException(status_code=HTTP_409_CONFLICT, detail="Username already exists")
        elif "users.email" in str(e):
            raise HTTPException(status_code=HTTP_409_CONFLICT, detail="Email already exists")
        else:
            raise HTTPException(
                status_code=HTTP_409_CONFLICT,
                detail="Failed to create user due to a conflict with existing data",
            )
    id_ = str(GlobalID("User", str(user.id)))
    data: User
    if isinstance(user_data, LocalUserData):
        data = LocalUser(
            id=id_,
            email=email,
            username=username,
            auth_method="LOCAL",
            role=user_data.role,
            created_at=user.created_at,
            updated_at=user.updated_at,
            password_needs_reset=user.reset_password,
        )
    elif isinstance(user_data, OAuth2UserData):
        data = OAuth2User(
            id=id_,
            email=email,
            username=username,
            auth_method="OAUTH2",
            role=user_data.role,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
        if user.oauth2_client_id:
            data.oauth2_client_id = user.oauth2_client_id
        if user.oauth2_user_id:
            data.oauth2_user_id = user.oauth2_user_id
        if user.profile_picture_url:
            data.profile_picture_url = user.profile_picture_url
    else:
        assert_never(user_data)
    # Send welcome email if requested
    if request_body.send_welcome_email and request.app.state.email_sender is not None:
        try:
            await request.app.state.email_sender.send_welcome_email(user.email, user.username)
        except Exception as error:
            # Log the error but do not raise it
            logger.error(f"Failed to send welcome email: {error}")
    return CreateUserResponseBody(data=data)


@router.delete(
    "/users/{user_id}",
    operation_id="deleteUser",
    summary="Delete a user by ID",
    description="Delete an existing user by their unique GlobalID.",
    response_description="No content returned on successful deletion.",
    status_code=HTTP_204_NO_CONTENT,
    responses=add_errors_to_responses(
        [
            {"status_code": HTTP_404_NOT_FOUND, "description": "User not found."},
            HTTP_422_UNPROCESSABLE_ENTITY,
            {
                "status_code": HTTP_403_FORBIDDEN,
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
