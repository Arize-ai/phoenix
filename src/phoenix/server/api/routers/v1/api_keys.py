"""
REST API endpoints for managing API keys.

Phoenix keeps user and system API keys in a single `api_keys` table; a key is a system
key when the user that owns it has the SYSTEM role. The two are exposed here as separate
resources:

- `/v1/user/api_keys` — the authenticated user's own personal keys. Useful for onboarding,
  where a user needs to hand a credential to an SDK or CLI.
- `/v1/system/api_keys` — system keys, which belong to the system user rather than to any
  human. Admin only.

The key itself is a JWT that Phoenix does not store in recoverable form. It is returned
exactly once, in the response to the request that creates it, and is never returned by the
list endpoints.

Every route here requires authentication to be enabled. When it is disabled, Phoenix has no
notion of identity, so issuing a credential would be an escalation of privilege.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from pydantic import Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import contains_eager
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.server.api.helpers.api_key_policy import (
    can_revoke_user_api_key,
    get_api_key_owner,
    get_system_user_id,
    get_user_api_key_authorization,
    get_user_role,
    get_user_role_and_api_keys,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    RequestBody,
    ResponseBody,
    add_errors_to_responses,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.authorization import is_not_locked, require_admin, require_auth_enabled
from phoenix.server.bearer_auth import PhoenixSystemUser, PhoenixUser
from phoenix.server.types import (
    AccessTokenClaims,
    ApiKeyAttributes,
    ApiKeyClaims,
    ApiKeyId,
    TokenStore,
    UserId,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["api_keys"])

# The node names used by the GraphQL schema for the two flavors of API key. Reusing them
# here keeps the GlobalIDs returned by REST interchangeable with the ones the UI already
# holds.
_USER_API_KEY = "UserApiKey"
_SYSTEM_API_KEY = "SystemApiKey"


class ApiKeyData(V1RoutesBaseModel):
    name: str = Field(description="A human-readable name for the API key.")
    description: Optional[str] = Field(
        default=None,
        description="An optional description of what the API key is for.",
    )
    expires_at: Optional[datetime] = Field(
        default=None,
        description="When the API key expires. The key never expires when omitted.",
    )

    @field_validator("name")
    @classmethod
    def _validate_name(cls, name: str) -> str:
        if not (name := name.strip()):
            raise ValueError("Name cannot be empty")
        return name

    @field_validator("expires_at")
    @classmethod
    def _validate_expires_at(cls, expires_at: Optional[datetime]) -> Optional[datetime]:
        if expires_at is None:
            return None
        # Naive datetimes are interpreted as UTC, matching how the token store stores them.
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            raise ValueError("Expiration time must be in the future")
        return expires_at


class ApiKey(V1RoutesBaseModel):
    id: str
    name: str
    description: Optional[str] = UNDEFINED
    created_at: datetime
    expires_at: Optional[datetime] = UNDEFINED


class CreatedApiKey(ApiKey):
    key: str = Field(
        description=(
            "The API key. This is the only time it is returned; "
            "it cannot be recovered from the listing endpoints."
        )
    )


class ApiKeyUser(V1RoutesBaseModel):
    id: str
    username: str
    email: Optional[str]


class UserApiKey(ApiKey):
    user: ApiKeyUser


class CreateApiKeyRequestBody(RequestBody[ApiKeyData]):
    pass


class CreateApiKeyResponseBody(ResponseBody[CreatedApiKey]):
    pass


class GetApiKeysResponseBody(ResponseBody[list[ApiKey]]):
    pass


class GetAllUserApiKeysResponseBody(PaginatedResponseBody[UserApiKey]):
    pass


def _to_api_key(api_key: models.ApiKey, node_name: str) -> ApiKey:
    return ApiKey(
        id=str(GlobalID(node_name, str(api_key.id))),
        name=api_key.name,
        description=api_key.description or UNDEFINED,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at or UNDEFINED,
    )


def _to_user_api_key(api_key: models.ApiKey) -> UserApiKey:
    user = api_key.user
    return UserApiKey(
        **_to_api_key(api_key, _USER_API_KEY).model_dump(),
        user=ApiKeyUser(
            id=str(GlobalID("User", str(user.id))),
            username=user.username,
            email=user.email,
        ),
    )


def _get_authenticated_user(request: Request) -> PhoenixUser:
    """
    Returns the user making the request.

    The router-level `is_authenticated` dependency has already rejected unauthenticated
    requests by the time a route body runs, so this is a type narrowing rather than a
    check, but it fails closed rather than assert.
    """
    if not isinstance(user := request.user, PhoenixUser):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def _create_api_key(
    request: Request,
    *,
    user_id: int,
    user_role: models.UserRoleName,
    data: ApiKeyData,
    node_name: str,
) -> CreatedApiKey:
    """
    Mints an API key for the given user and returns it. The returned `key` is the only
    copy; Phoenix stores a record of the key's metadata but not the key itself.
    """
    token_store: TokenStore = request.app.state.get_token_store()
    issued_at = datetime.now(timezone.utc)
    claims = ApiKeyClaims(
        subject=UserId(user_id),
        issued_at=issued_at,
        expiration_time=data.expires_at,
        attributes=ApiKeyAttributes(
            user_role=user_role,
            name=data.name,
            description=data.description,
        ),
    )
    key, token_id = await token_store.create_api_key(claims)
    return CreatedApiKey(
        id=str(GlobalID(node_name, str(int(token_id)))),
        name=data.name,
        description=data.description or UNDEFINED,
        created_at=issued_at,
        expires_at=data.expires_at or UNDEFINED,
        key=key,
    )


async def _revoke_api_key(request: Request, api_key_id: int) -> None:
    token_store: TokenStore = request.app.state.get_token_store()
    await token_store.revoke(ApiKeyId(api_key_id))


def _parse_api_key_id(api_key_id: str, node_name: str) -> int:
    try:
        return from_global_id_with_expected_type(GlobalID.from_id(api_key_id), node_name)
    except Exception:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {node_name} GlobalID format: {api_key_id}",
        )


async def require_human_session(request: Request) -> models.UserRoleName:
    """
    Require an access-token session and return its current database role.

    An API key is a delegated credential. Allowing it to issue a replacement would let a
    compromised key preserve access after the original is revoked. Issuance therefore
    starts from a human session, and the database role is reused when constructing the key.
    """
    user = _get_authenticated_user(request)
    if isinstance(user, PhoenixSystemUser) or not isinstance(user.claims, AccessTokenClaims):
        raise HTTPException(status_code=403, detail="API keys cannot create API keys")
    user_id = int(user.identity)
    async with request.app.state.db() as session:
        user_role = await get_user_role(session, user_id)
    if user_role is None:
        raise HTTPException(status_code=401, detail="User not found")
    if user_role == "SYSTEM":
        raise HTTPException(
            status_code=403,
            detail="System API keys must be managed through the /system/api_keys endpoints.",
        )
    return user_role


def require_session_or_admin_secret(request: Request) -> None:
    """Require an access-token session or the configured admin-secret principal."""
    user = _get_authenticated_user(request)
    if isinstance(user, PhoenixSystemUser):
        return
    if not isinstance(user.claims, AccessTokenClaims):
        raise HTTPException(status_code=403, detail="API keys cannot create API keys")


def reject_system_api_key(request: Request) -> None:
    """Reject a SYSTEM-role API key while admitting the admin-secret principal.

    A SYSTEM API key is a workload credential and cannot manage user keys, so it is rejected
    early and categorically. The admin-secret principal shares the system user's identity but
    carries configured admin authority; it is admitted here and authorized by the route body's
    cross-user revocation logic.
    """
    user = _get_authenticated_user(request)
    if isinstance(user, PhoenixSystemUser):
        return
    if user.claims.attributes is not None and user.claims.attributes.user_role == "SYSTEM":
        raise HTTPException(
            status_code=403,
            detail="System API keys must be managed through the /system/api_keys endpoints.",
        )


@router.get(
    "/user/api_keys",
    operation_id="getUserApiKeys",
    summary="List the authenticated user's API keys",
    description=(
        "Retrieve the API keys belonging to the currently authenticated user. "
        "The keys themselves are not recoverable and are never included in the response."
    ),
    response_description="The authenticated user's API keys.",
    dependencies=[Depends(require_auth_enabled)],
    responses=add_errors_to_responses([401]),
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def list_user_api_keys(request: Request) -> GetApiKeysResponseBody:
    user_id = int(_get_authenticated_user(request).identity)
    async with request.app.state.db() as session:
        user_role, api_keys = await get_user_role_and_api_keys(session, user_id)
    if user_role is None:
        raise HTTPException(status_code=401, detail="User not found")
    # A system-backed principal owns no user-class keys, so its personal collection is empty
    # rather than forbidden. This matches GraphQL's `viewer { apiKeys }`, letting a caller
    # swap surfaces without handling a 403 on one and an empty list on the other. The keys
    # owned by the system user are system keys and are deliberately not returned here.
    if user_role == "SYSTEM":
        return GetApiKeysResponseBody(data=[])
    return GetApiKeysResponseBody(data=[_to_api_key(k, _USER_API_KEY) for k in api_keys])


@router.get(
    "/users/api_keys",
    operation_id="getAllUserApiKeys",
    summary="List all user API keys",
    description=(
        "Retrieve API keys belonging to human users across the organization. "
        "System API keys are excluded. Restricted to admins."
    ),
    response_description="A paginated list of user API keys and their owners.",
    dependencies=[Depends(require_auth_enabled), Depends(require_admin)],
    responses=add_errors_to_responses([401, 422]),
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def list_all_user_api_keys(
    request: Request,
    cursor: Optional[str] = Query(
        default=None,
        description="Cursor for pagination (a UserApiKey GlobalID).",
    ),
    limit: int = Query(
        default=100,
        description="The maximum number of API keys to return (at most 1000).",
        gt=0,
        le=1000,
    ),
) -> GetAllUserApiKeysResponseBody:
    stmt = (
        select(models.ApiKey)
        .join(models.User, models.User.id == models.ApiKey.user_id)
        .join(models.UserRole, models.UserRole.id == models.User.user_role_id)
        .where(models.UserRole.name != "SYSTEM")
        .options(contains_eager(models.ApiKey.user))
        .order_by(models.ApiKey.id.desc())
    )
    if cursor:
        stmt = stmt.where(models.ApiKey.id <= _parse_api_key_id(cursor, _USER_API_KEY))
    stmt = stmt.limit(limit + 1)
    async with request.app.state.db() as session:
        api_keys = list((await session.scalars(stmt)).unique().all())
    next_cursor = None
    if len(api_keys) == limit + 1:
        next_cursor = str(GlobalID(_USER_API_KEY, str(api_keys[-1].id)))
        api_keys = api_keys[:-1]
    return GetAllUserApiKeysResponseBody(
        data=[_to_user_api_key(api_key) for api_key in api_keys],
        next_cursor=next_cursor,
    )


@router.post(
    "/user/api_keys",
    operation_id="createUserApiKey",
    summary="Create an API key for the authenticated user",
    description=(
        "Create a personal API key for the currently authenticated user. The key inherits "
        "the user's role, so it grants no more access than the user already has. "
        "Creation requires an access-token session; API keys cannot mint replacement keys. "
        "The response contains the key itself, which is shown only once and cannot be "
        "retrieved afterwards."
    ),
    response_description="The newly created API key, including the key itself.",
    status_code=201,
    dependencies=[Depends(require_auth_enabled), Depends(is_not_locked)],
    responses=add_errors_to_responses([401, 422, 507]),
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def create_user_api_key(
    request: Request,
    request_body: CreateApiKeyRequestBody,
    user_role: models.UserRoleName = Depends(require_human_session),
) -> CreateApiKeyResponseBody:
    # The role comes from require_human_session, which has already rejected API keys and
    # the system user, so a personal key can only inherit a current human role.
    user_id = int(_get_authenticated_user(request).identity)
    data = await _create_api_key(
        request,
        user_id=user_id,
        user_role=user_role,
        data=request_body.data,
        node_name=_USER_API_KEY,
    )
    return CreateApiKeyResponseBody(data=data)


@router.delete(
    "/user/api_keys/{api_key_id}",
    operation_id="deleteUserApiKey",
    summary="Delete a user API key",
    description=(
        "Permanently revoke a user API key. Users can revoke their own keys, and admins "
        "can revoke keys belonging to other users. The key stops working immediately."
    ),
    response_description="No content returned on successful deletion.",
    status_code=204,
    dependencies=[Depends(require_auth_enabled), Depends(reject_system_api_key)],
    responses=add_errors_to_responses(
        [
            401,
            {"status_code": 404, "description": "API key not found."},
            422,
        ]
    ),
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def delete_user_api_key(
    request: Request,
    api_key_id: str = Path(..., description="The GlobalID of the API key."),
) -> None:
    user = _get_authenticated_user(request)
    user_id = int(user.identity)
    # The admin-secret principal has no personal keys but carries configured admin authority,
    # so it may revoke another user's key even though its database role is SYSTEM.
    caller_is_admin_secret = isinstance(user, PhoenixSystemUser)
    id_ = _parse_api_key_id(api_key_id, _USER_API_KEY)
    async with request.app.state.db() as session:
        authorization = await get_user_api_key_authorization(
            session,
            caller_id=user_id,
            api_key_id=id_,
        )
    if authorization is None and not caller_is_admin_secret:
        raise HTTPException(status_code=401, detail="User not found")
    # A key owned by someone else is reported as missing rather than forbidden so that this
    # endpoint cannot be used to probe for the existence of other users' keys.
    if not can_revoke_user_api_key(
        caller_id=user_id,
        caller_is_admin_secret=caller_is_admin_secret,
        authorization=authorization,
    ):
        raise HTTPException(status_code=404, detail="API key not found")
    await _revoke_api_key(request, id_)
    return None


@router.get(
    "/system/api_keys",
    operation_id="getSystemApiKeys",
    summary="List system API keys",
    description=(
        "Retrieve all system API keys. System keys belong to the system user rather than to "
        "any human, so this endpoint is restricted to admins. The keys themselves are not "
        "recoverable and are never included in the response."
    ),
    response_description="The system API keys.",
    dependencies=[Depends(require_auth_enabled), Depends(require_admin)],
    responses=add_errors_to_responses([401]),
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def list_system_api_keys(request: Request) -> GetApiKeysResponseBody:
    async with request.app.state.db() as session:
        api_keys = (
            await session.scalars(
                select(models.ApiKey)
                .join(models.User, models.User.id == models.ApiKey.user_id)
                .join(models.UserRole, models.UserRole.id == models.User.user_role_id)
                .where(models.UserRole.name == "SYSTEM")
                .order_by(models.ApiKey.id.desc())
            )
        ).all()
    return GetApiKeysResponseBody(data=[_to_api_key(k, _SYSTEM_API_KEY) for k in api_keys])


@router.post(
    "/system/api_keys",
    operation_id="createSystemApiKey",
    summary="Create a system API key",
    description=(
        "Create a system API key. System keys belong to the system user rather than to any "
        "human, so this endpoint is restricted to admins. Creation requires an admin "
        "access-token session or the configured admin secret; API keys cannot mint keys. "
        "The response contains the key itself, which is shown only once and cannot be "
        "retrieved afterwards."
    ),
    response_description="The newly created system API key, including the key itself.",
    status_code=201,
    dependencies=[
        Depends(require_auth_enabled),
        Depends(require_admin),
        Depends(require_session_or_admin_secret),
        Depends(is_not_locked),
    ],
    responses=add_errors_to_responses([401, 422, 507]),
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def create_system_api_key(
    request: Request,
    request_body: CreateApiKeyRequestBody,
) -> CreateApiKeyResponseBody:
    async with request.app.state.db() as session:
        system_user_id = await get_system_user_id(session)
    if system_user_id is None:
        logger.error("System user not found")
        raise HTTPException(status_code=500, detail="System user not found")
    data = await _create_api_key(
        request,
        user_id=system_user_id,
        user_role="SYSTEM",
        data=request_body.data,
        node_name=_SYSTEM_API_KEY,
    )
    return CreateApiKeyResponseBody(data=data)


@router.delete(
    "/system/api_keys/{api_key_id}",
    operation_id="deleteSystemApiKey",
    summary="Delete a system API key",
    description=(
        "Permanently revoke a system API key. The key stops working immediately. "
        "Restricted to admins."
    ),
    response_description="No content returned on successful deletion.",
    status_code=204,
    dependencies=[Depends(require_auth_enabled), Depends(require_admin)],
    responses=add_errors_to_responses(
        [
            401,
            {"status_code": 404, "description": "System API key not found."},
            422,
        ]
    ),
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def delete_system_api_key(
    request: Request,
    api_key_id: str = Path(..., description="The GlobalID of the system API key."),
) -> None:
    id_ = _parse_api_key_id(api_key_id, _SYSTEM_API_KEY)
    async with request.app.state.db() as session:
        owner = await get_api_key_owner(session, id_)
    # Personal keys are not system keys, so they are invisible to this endpoint even though
    # they live in the same table.
    if owner is None or not owner.is_system:
        raise HTTPException(status_code=404, detail="System API key not found")
    await _revoke_api_key(request, id_)
    return None
