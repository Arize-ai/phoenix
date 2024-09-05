from abc import ABC
from typing import Any, Awaitable, Callable, Optional, Tuple

import grpc
from fastapi import Request
from grpc_interceptor import AsyncServerInterceptor
from grpc_interceptor.exceptions import Unauthenticated
from starlette.authentication import AuthCredentials, AuthenticationBackend, BaseUser
from starlette.exceptions import HTTPException
from starlette.requests import HTTPConnection
from starlette.status import HTTP_401_UNAUTHORIZED

from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    CanReadToken,
    ClaimSetStatus,
    Token,
)
from phoenix.server.types import AccessTokenClaims, ApiKeyClaims, UserClaimSet, UserId


class HasTokenStore(ABC):
    def __init__(self, token_store: CanReadToken) -> None:
        super().__init__()
        self._token_store = token_store


class BearerTokenAuthBackend(HasTokenStore, AuthenticationBackend):
    async def authenticate(
        self,
        conn: HTTPConnection,
    ) -> Optional[Tuple[AuthCredentials, BaseUser]]:
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

    @property
    def identity(self) -> UserId:
        return self._user_id

    @property
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


async def is_authenticated(request: Request) -> None:
    """
    Raises a 401 if the request is not authenticated.
    """
    if not isinstance((user := request.user), PhoenixUser):
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Invalid token")
    claims = user.claims
    if claims.status is ClaimSetStatus.EXPIRED:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Expired token")
    if claims.status is not ClaimSetStatus.VALID:
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED, detail="Invalid token")
