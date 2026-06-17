from abc import ABC
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone
from functools import cached_property
from typing import Any, Optional, cast

import grpc
from fastapi import HTTPException, Request, WebSocket, WebSocketException
from grpc_interceptor import AsyncServerInterceptor
from starlette.authentication import AuthCredentials, AuthenticationBackend, BaseUser
from starlette.requests import HTTPConnection
from typing_extensions import override

from phoenix import config
from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    CanReadToken,
    ClaimSetStatus,
    Token,
)
from phoenix.config import get_env_phoenix_admin_secret
from phoenix.db import models
from phoenix.server.access import Permission, permissions_for_role
from phoenix.server.api_key_scope import deny_unknown_grpc_scope
from phoenix.server.types import (
    AccessToken,
    AccessTokenAttributes,
    AccessTokenClaims,
    ApiKeyClaims,
    RefreshToken,
    RefreshTokenAttributes,
    RefreshTokenClaims,
    TokenStore,
    UserClaimSet,
    UserId,
)


class HasTokenStore(ABC):
    def __init__(self, token_store: CanReadToken) -> None:
        super().__init__()
        self._token_store = token_store


class BearerTokenAuthBackend(HasTokenStore, AuthenticationBackend):
    async def authenticate(
        self,
        conn: HTTPConnection,
    ) -> Optional[tuple[AuthCredentials, BaseUser]]:
        if header := conn.headers.get("Authorization"):
            scheme, _, token = header.partition(" ")
            if scheme.lower() != "bearer" or not token:
                return None
            if (
                (admin_secret := get_env_phoenix_admin_secret())
                and token == admin_secret.get_secret_value()
                and config.SYSTEM_USER_ID is not None
            ):
                return AuthCredentials(), PhoenixSystemUser(UserId(config.SYSTEM_USER_ID))
        elif access_token := conn.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME):
            token = access_token
        else:
            return None
        claims = await self._token_store.read(Token(token))
        if not (isinstance(claims, UserClaimSet) and isinstance(claims.subject, UserId)):
            return None
        if not isinstance(claims, (ApiKeyClaims, AccessTokenClaims)):
            return None
        return AuthCredentials(), PhoenixUser(claims.subject, claims)


class PhoenixUser(BaseUser):
    def __init__(self, user_id: UserId, claims: UserClaimSet) -> None:
        self._user_id = user_id
        self.claims = claims
        assert claims.attributes
        # The role is authoritative only for a valid claim set; otherwise the
        # user resolves to no permissions (the oracle fails closed).
        self._role_name: Optional[str] = (
            claims.attributes.user_role if claims.status is ClaimSetStatus.VALID else None
        )

    @cached_property
    def permissions(self) -> frozenset[Permission]:
        """The user's permissions, resolved from their role through the oracle."""
        return permissions_for_role(self._role_name) if self._role_name else frozenset()

    def can(self, permission: Permission) -> bool:
        return permission in self.permissions

    @cached_property
    def is_admin(self) -> bool:
        # An admin is anyone holding the ADMINISTER permission (SYSTEM, ADMIN).
        return Permission.ADMINISTER in self.permissions

    @cached_property
    def is_viewer(self) -> bool:
        # A viewer is a valid user who cannot write — i.e. read-only.
        return self._role_name is not None and Permission.WRITE not in self.permissions

    @cached_property
    def identity(self) -> UserId:
        return self._user_id

    @cached_property
    def is_authenticated(self) -> bool:
        return True


class PhoenixSystemUser(PhoenixUser):
    def __init__(self, user_id: UserId) -> None:
        self._user_id = user_id
        # System users carry the SYSTEM role and therefore every permission.
        self._role_name = "SYSTEM"


class ApiKeyInterceptor(HasTokenStore, AsyncServerInterceptor):
    @override
    async def intercept(
        self,
        method: Callable[[Any, grpc.aio.ServicerContext], Awaitable[Any]],
        request_or_iterator: Any,
        context: grpc.aio.ServicerContext,
        method_name: str,
    ) -> Any:
        for key, value in context.invocation_metadata() or ():
            if key.lower() == "authorization":
                if isinstance(value, bytes):
                    value = value.decode("utf-8")
                scheme, _, token = value.partition(" ")
                if scheme.lower() != "bearer" or not token:
                    break
                if (
                    (admin_secret := get_env_phoenix_admin_secret())
                    and token == admin_secret.get_secret_value()
                    and config.SYSTEM_USER_ID is not None
                ):
                    return await method(request_or_iterator, context)
                claims = await self._token_store.read(Token(token))
                if (
                    not (
                        isinstance(claims, (ApiKeyClaims, AccessTokenClaims))
                        and isinstance(claims.subject, UserId)
                    )
                    or claims.status is not ClaimSetStatus.VALID
                ):
                    break
                # The gRPC server serves only OTLP trace export, so the
                # "ingest" scope (and the absence of a scope) passes; any
                # unrecognized scope fails closed.
                if (
                    isinstance(claims, ApiKeyClaims)
                    and claims.attributes is not None
                    and deny_unknown_grpc_scope(claims.attributes.scope)
                ):
                    await context.abort(grpc.StatusCode.PERMISSION_DENIED)
                return await method(request_or_iterator, context)
        await context.abort(grpc.StatusCode.UNAUTHENTICATED)


async def is_authenticated(
    # fastapi dependencies require non-optional types
    request: Request = cast(Request, None),
    websocket: WebSocket = cast(WebSocket, None),
) -> None:
    """
    Raises a 401 if the request or websocket connection is not authenticated.
    """
    assert request or websocket
    if request and not isinstance((user := request.user), PhoenixUser):
        raise HTTPException(status_code=401, detail="Invalid token")
    if websocket and not isinstance((user := websocket.user), PhoenixUser):
        raise WebSocketException(code=401, reason="Invalid token")
    if isinstance(user, PhoenixSystemUser):
        return
    claims = user.claims
    if claims.status is ClaimSetStatus.EXPIRED:
        raise HTTPException(status_code=401, detail="Expired token")
    if claims.status is not ClaimSetStatus.VALID:
        raise HTTPException(status_code=401, detail="Invalid token")


async def create_access_and_refresh_tokens(
    *,
    token_store: TokenStore,
    user: models.User,
    access_token_expiry: timedelta,
    refresh_token_expiry: timedelta,
) -> tuple[AccessToken, RefreshToken]:
    issued_at = datetime.now(timezone.utc)
    user_id = UserId(user.id)
    user_role = user.role.name
    refresh_token_claims = RefreshTokenClaims(
        subject=user_id,
        issued_at=issued_at,
        expiration_time=issued_at + refresh_token_expiry,
        attributes=RefreshTokenAttributes(
            user_role=user_role,
        ),
    )
    refresh_token, refresh_token_id = await token_store.create_refresh_token(refresh_token_claims)
    access_token_claims = AccessTokenClaims(
        subject=user_id,
        issued_at=issued_at,
        expiration_time=issued_at + access_token_expiry,
        attributes=AccessTokenAttributes(
            user_role=user_role,
            refresh_token_id=refresh_token_id,
        ),
    )
    access_token, _ = await token_store.create_access_token(access_token_claims)
    return access_token, refresh_token
