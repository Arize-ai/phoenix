from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from sqlalchemy import select
from starlette.status import (
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
    HTTP_422_UNPROCESSABLE_ENTITY,
)
from strawberry.relay import GlobalID

from phoenix.auth import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_SYSTEM_EMAIL,
    DEFAULT_SYSTEM_USERNAME,
    validate_email_format,
    validate_password_format,
)
from phoenix.db.enums import UserRole as UserRoleEnum
from phoenix.db.models import User as OrmUser
from phoenix.db.models import UserRole
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.authorization import require_admin
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    add_errors_to_responses,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type

router = APIRouter(tags=["users"])


class UserCreate(V1RoutesBaseModel):
    email: str
    username: str
    password: str
    role: str


class User(V1RoutesBaseModel):
    id: str
    email: str
    username: str
    profile_picture_url: Optional[str] = None
    created_at: datetime
    role: str
    password_needs_reset: bool
    auth_method: Optional[str] = None


class GetUsersResponseBody(PaginatedResponseBody[User]):
    pass


class GetUserResponseBody(ResponseBody[User]):
    pass


class CreateUserRequestBody(V1RoutesBaseModel):
    user: UserCreate


class CreateUserResponseBody(ResponseBody[User]):
    pass


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
)
async def list_users(
    request: Request,
    cursor: str = Query(default=None, description="Cursor for pagination (base64-encoded user ID)"),
    limit: int = Query(
        default=100, description="The max number of users to return at a time.", gt=0
    ),
) -> GetUsersResponseBody:
    stmt = (
        select(
            OrmUser.id,
            OrmUser.email,
            OrmUser.username,
            OrmUser.profile_picture_url,
            OrmUser.created_at,
            OrmUser.reset_password,
            OrmUser.auth_method,
            UserRole.name.label("role"),
        )
        .join(UserRole, OrmUser.user_role_id == UserRole.id)
        .order_by(OrmUser.id.desc())
    )
    if cursor:
        try:
            cursor_id = GlobalID.from_id(cursor).node_id
            stmt = stmt.filter(OrmUser.id <= int(cursor_id))
        except Exception:
            raise HTTPException(status_code=422, detail=f"Invalid cursor format: {cursor}")
    stmt = stmt.limit(limit + 1)
    async with request.app.state.db() as db:
        result = await db.execute(stmt)
        users = result.all()
    next_cursor = None
    if len(users) == limit + 1:
        last_user = users[-1]
        next_cursor = str(GlobalID("User", str(last_user.id)))
        users = users[:-1]
    user_objs = [
        User(
            id=str(GlobalID("User", str(row.id))),
            email=row.email,
            username=row.username,
            profile_picture_url=row.profile_picture_url,
            created_at=row.created_at,
            role=row.role,
            password_needs_reset=row.reset_password,
            auth_method=row.auth_method or "",
        )
        for row in users
    ]
    return GetUsersResponseBody(next_cursor=next_cursor, data=user_objs)


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
            HTTP_422_UNPROCESSABLE_ENTITY,
        ]
    ),
    dependencies=[Depends(require_admin)],
)
async def create_user(
    request: Request,
    request_body: CreateUserRequestBody,
) -> CreateUserResponseBody:
    user = request_body.user
    # Validate email and password formats
    validate_email_format(user.email)
    validate_password_format(user.password)
    async with request.app.state.db() as db:
        # Resolve role string to user_role_id
        role_row = await db.execute(select(UserRole.id).where(UserRole.name == user.role))
        user_role_id = role_row.scalar_one_or_none()
        if user_role_id is None:
            raise HTTPException(status_code=400, detail=f"Role '{user.role}' not found")
        new_user = OrmUser(
            email=user.email,
            username=user.username,
            password_hash=user.password,  # Replace with hash in real code
            user_role_id=user_role_id,
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        # Fetch the role string for the new user
        role_row = await db.execute(
            select(UserRole.name).where(UserRole.id == new_user.user_role_id)
        )
        role = role_row.scalar_one_or_none() or ""
        user_obj = User(
            id=str(GlobalID("User", str(new_user.id))),
            email=new_user.email,
            username=new_user.username,
            profile_picture_url=new_user.profile_picture_url,
            created_at=new_user.created_at,
            role=role,
            password_needs_reset=new_user.reset_password,
            auth_method=new_user.auth_method or "",
        )
        return CreateUserResponseBody(data=user_obj)


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
                "status_code": HTTP_409_CONFLICT,
                "description": "Cannot delete the default admin or system user",
            },
        ]
    ),
    dependencies=[Depends(require_admin)],
)
async def delete_user(
    request: Request,
    user_id: str = Path(
        ..., description="The GlobalID of the user (base64-encoded, e.g. 'VXNlcjox')."
    ),
) -> None:
    try:
        user_pk = from_global_id_with_expected_type(GlobalID.from_id(user_id), "User")
    except Exception:
        raise HTTPException(status_code=422, detail=f"Invalid User GlobalID format: {user_id}")
    async with request.app.state.db() as db:
        user = await db.get(OrmUser, user_pk)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        # Prevent deletion of system and default admin users
        role = await db.get(UserRole, user.user_role_id)
        if (
            user.email == DEFAULT_ADMIN_EMAIL
            and user.username == DEFAULT_ADMIN_USERNAME
            and role
            and role.name == UserRoleEnum.ADMIN.value
        ) or (
            user.email == DEFAULT_SYSTEM_EMAIL
            and user.username == DEFAULT_SYSTEM_USERNAME
            and role
            and role.name == UserRoleEnum.SYSTEM.value
        ):
            raise HTTPException(
                status_code=409, detail="Cannot delete the default admin or system user"
            )
        await db.delete(user)
        await db.commit()
    return None
