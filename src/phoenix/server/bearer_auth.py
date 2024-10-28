from abc import ABC
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone
from functools import cached_property
from typing import Any, Optional, cast

import grpc
from fastapi import HTTPException, Request, WebSocket, WebSocketException
from grpc_interceptor import AsyncServerInterceptor
from grpc_interceptor.exceptions import Unauthenticated
from starlette.authentication import AuthCredentials, AuthenticationBackend, BaseUser
from starlette.requests import HTTPConnection
from starlette.status import HTTP_401_UNAUTHORIZED

from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    CanReadToken,
    ClaimSetStatus,
    Token,
)
from phoenix.db import enums
from phoenix.db.enums import UserRole
from phoenix.db.models import User as OrmUser
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
        self._is_admin = (
            claims.status is ClaimSetStatus.VALID
            and claims.attributes.user_role == enums.UserRole.ADMIN
        )

    @cached_property
    def is_admin(self) -> bool:
        return self._is_admin

    @cached_property
    def identity(self) -> UserId:
        return self._user_id

    @cached_property
    def is_authenticated(self) -> bool:
        return True


class ApiKeyInterceptor(HasTokenStore, AsyncServerInterceptor):
    async def intercept(
        self,
        method: Callable[[Any, grpc.ServicerContext], Awaitable[Any]],
        request_or_iterator: Any,
        context: grpc.ServicerContext,
        method_name: str,
    ) -> Any:
        for datum in context.invocation_metadata():
            if datum.key.lower() == "authorization":
                scheme, _, token = datum.value.partition(" ")
                if scheme.lower() != "bearer" or not token:
                    break
                claims = await self._token_store.read(Token(token))
                if not (isinstance(claims, UserClaimSet) and isinstance(claims.subject, UserId)):
                    break
                if not isinstance(claims, (ApiKeyClaims, AccessTokenClaims)):
                    raise Unauthenticated(details="Invalid token")
                if claims.status is ClaimSetStatus.EXPIRED:
                    raise Unauthenticated(details="Expired token")
                if claims.status is ClaimSetStatus.VALID:
                    return await method(request_or_iterator, context)
                raise Unauthenticated()
        raise Unauthenticated()


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
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if websocket and not isinstance((user := websocket.user), PhoenixUser):
        raise WebSocketException(code=HTTP_401_UNAUTHORIZED, reason="Invalid token")
    claims = user.claims
    if claims.status is ClaimSetStatus.EXPIRED:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Expired token")
    if claims.status is not ClaimSetStatus.VALID:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def create_access_and_refresh_tokens(
    *,
    token_store: TokenStore,
    user: OrmUser,
    access_token_expiry: timedelta,
    refresh_token_expiry: timedelta,
) -> tuple[AccessToken, RefreshToken]:
    issued_at = datetime.now(timezone.utc)
    user_id = UserId(user.id)
    user_role = UserRole(user.role.name)
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
