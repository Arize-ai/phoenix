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

from fastapi import APIRouter, Depends, HTTPException, Path, Request
from pydantic import Field, field_validator
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.db_helper_types import UNDEFINED
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import (
    RequestBody,
    ResponseBody,
    add_errors_to_responses,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.authorization import is_not_locked, require_admin, require_auth_enabled
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.types import ApiKeyAttributes, ApiKeyClaims, ApiKeyId, TokenStore, UserId

logger = logging.getLogger(__name__)

router = APIRouter(tags=["api_keys"])

# The node names used by the GraphQL schema for the two flavors of API key. Reusing them
# here keeps the GlobalIDs returned by REST interchangeable with the ones the UI already
# holds.
_USER_API_KEY = "UserApiKey"
_SYSTEM_API_KEY = "SystemApiKey"

_SYSTEM_ROLE: models.UserRoleName = "SYSTEM"


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


class CreateApiKeyRequestBody(RequestBody[ApiKeyData]):
    pass


class CreateApiKeyResponseBody(ResponseBody[CreatedApiKey]):
    pass


class GetApiKeysResponseBody(ResponseBody[list[ApiKey]]):
    pass


def _to_api_key(api_key: models.ApiKey, node_name: str) -> ApiKey:
    return ApiKey(
        id=str(GlobalID(node_name, str(api_key.id))),
        name=api_key.name,
        description=api_key.description or UNDEFINED,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at or UNDEFINED,
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
        api_keys = (
            await session.scalars(
                select(models.ApiKey)
                .where(models.ApiKey.user_id == user_id)
                .order_by(models.ApiKey.id.desc())
            )
        ).all()
    return GetApiKeysResponseBody(data=[_to_api_key(k, _USER_API_KEY) for k in api_keys])


@router.post(
    "/user/api_keys",
    operation_id="createUserApiKey",
    summary="Create an API key for the authenticated user",
    description=(
        "Create a personal API key for the currently authenticated user. The key inherits "
        "the user's role, so it grants no more access than the user already has. "
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
) -> CreateApiKeyResponseBody:
    user_id = int(_get_authenticated_user(request).identity)
    async with request.app.state.db() as session:
        user_role = await session.scalar(
            select(models.UserRole.name)
            .join(models.User, models.User.user_role_id == models.UserRole.id)
            .where(models.User.id == user_id)
        )
    if user_role is None:
        raise HTTPException(status_code=401, detail="User not found")
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
    summary="Delete one of the authenticated user's API keys",
    description=(
        "Permanently revoke an API key belonging to the currently authenticated user. "
        "The key stops working immediately. Keys owned by other users are not visible "
        "here and cannot be deleted through this endpoint."
    ),
    response_description="No content returned on successful deletion.",
    status_code=204,
    dependencies=[Depends(require_auth_enabled)],
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
    user_id = int(_get_authenticated_user(request).identity)
    id_ = _parse_api_key_id(api_key_id, _USER_API_KEY)
    async with request.app.state.db() as session:
        owner_id = await session.scalar(
            select(models.ApiKey.user_id).where(models.ApiKey.id == id_)
        )
    # A key owned by someone else is reported as missing rather than forbidden so that this
    # endpoint cannot be used to probe for the existence of other users' keys.
    if owner_id is None or owner_id != user_id:
        raise HTTPException(status_code=404, detail="API key not found")
    await _revoke_api_key(request, id_)
    return None


@router.get(
    "/system/api_keys",
    operation_id="getSystemApiKeys",
    summary="List system API keys",
    description=(
        "Retrieve all system API keys. System keys are not tied to a human user and carry "
        "full privileges, so this endpoint is restricted to admins. The keys themselves "
        "are not recoverable and are never included in the response."
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
                .where(models.UserRole.name == _SYSTEM_ROLE)
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
        "human, and they carry full privileges, so this endpoint is restricted to admins. "
        "The response contains the key itself, which is shown only once and cannot be "
        "retrieved afterwards."
    ),
    response_description="The newly created system API key, including the key itself.",
    status_code=201,
    dependencies=[Depends(require_auth_enabled), Depends(require_admin), Depends(is_not_locked)],
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
        system_user_id = await session.scalar(
            select(models.User.id)
            .join(models.UserRole, models.UserRole.id == models.User.user_role_id)
            .where(models.UserRole.name == _SYSTEM_ROLE)
            .order_by(models.User.id)
            .limit(1)
        )
    if system_user_id is None:
        logger.error("System user not found")
        raise HTTPException(status_code=500, detail="System user not found")
    data = await _create_api_key(
        request,
        user_id=system_user_id,
        user_role=_SYSTEM_ROLE,
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
        role = await session.scalar(
            select(models.UserRole.name)
            .join(models.User, models.User.user_role_id == models.UserRole.id)
            .join(models.ApiKey, models.ApiKey.user_id == models.User.id)
            .where(models.ApiKey.id == id_)
        )
    # Personal keys are not system keys, so they are invisible to this endpoint even though
    # they live in the same table.
    if role != _SYSTEM_ROLE:
        raise HTTPException(status_code=404, detail="System API key not found")
    await _revoke_api_key(request, id_)
    return None
