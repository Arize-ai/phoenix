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


def _has_read_only_grant_scope(claims: UserClaimSet) -> bool:
    """True when the token was minted under a read-only OAuth grant."""
    from phoenix.server.types import (
        GRANT_SCOPE_READ_ONLY,
        AccessTokenAttributes,
        RefreshTokenAttributes,
    )

    attributes = claims.attributes
    if not isinstance(attributes, (AccessTokenAttributes, RefreshTokenAttributes)):
        return False
    if attributes.scopes is None:
        return False
    return GRANT_SCOPE_READ_ONLY in attributes.scopes


class PhoenixUser(BaseUser):
    def __init__(self, user_id: UserId, claims: UserClaimSet) -> None:
        self._user_id = user_id
        self.claims = claims
        assert claims.attributes
        # Read-only OAuth grants clamp role flags to VIEWER-equivalent reads with
        # admin surfaces denied, even when the underlying account is ADMIN.
        if _has_read_only_grant_scope(claims) and claims.status is ClaimSetStatus.VALID:
            self._is_admin = False
            self._is_viewer = True
        else:
            self._is_admin = (
                claims.status is ClaimSetStatus.VALID and claims.attributes.user_role == "ADMIN"
            )
            self._is_viewer = (
                claims.status is ClaimSetStatus.VALID and claims.attributes.user_role == "VIEWER"
            )

    @cached_property
    def is_admin(self) -> bool:
        return self._is_admin

    @cached_property
    def is_viewer(self) -> bool:
        return self._is_viewer

    @cached_property
    def identity(self) -> UserId:
        return self._user_id

    @cached_property
    def is_authenticated(self) -> bool:
        return True


class PhoenixSystemUser(PhoenixUser):
    def __init__(self, user_id: UserId) -> None:
        self._user_id = user_id
        self._is_admin = True  # System users have admin privileges
        self._is_viewer = False  # System users are not viewers

    @property
    def is_admin(self) -> bool:
        return True


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
                # OTLP ingest is a write. Read-only OAuth grants and viewer-role
                # tokens are authenticated but not authorized to write — reject
                # with PERMISSION_DENIED (not UNAUTHENTICATED).
                if _has_read_only_grant_scope(claims) or (
                    claims.attributes is not None and claims.attributes.user_role == "VIEWER"
                ):
                    await context.abort(grpc.StatusCode.PERMISSION_DENIED)
                    return
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
    grant_id: Optional[int] = None,
    scopes: Optional[tuple[str, ...]] = None,
) -> tuple[AccessToken, RefreshToken]:
    """Mint a paired access/refresh token.

    When ``grant_id`` is set the tokens are linked to an OAuth2 grant and carry a
    denormalized ``scopes`` snapshot. Web-session callers leave both unset so
    behavior is unchanged.
    """
    if grant_id is not None and scopes is None:
        raise ValueError("scopes are required when minting tokens under an OAuth2 grant")
    issued_at = datetime.now(timezone.utc)
    user_id = UserId(user.id)
    user_role = user.role.name
    refresh_token_claims = RefreshTokenClaims(
        subject=user_id,
        issued_at=issued_at,
        expiration_time=issued_at + refresh_token_expiry,
        attributes=RefreshTokenAttributes(
            user_role=user_role,
            grant_id=grant_id,
            scopes=scopes,
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
            grant_id=grant_id,
            scopes=scopes,
        ),
    )
    access_token, _ = await token_store.create_access_token(access_token_claims)
    return access_token, refresh_token
