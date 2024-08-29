from abc import ABC
from typing import Any, Awaitable, Callable, Optional, Tuple

import grpc
from grpc_interceptor import AsyncServerInterceptor
from grpc_interceptor.exceptions import PermissionDenied, Unauthenticated
from starlette.authentication import AuthCredentials, AuthenticationBackend, BaseUser
from starlette.requests import HTTPConnection

from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
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
        elif refresh_token := conn.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME):
            token = refresh_token
        else:
            return None
        claims = await self._token_store.read(Token(token))
        if isinstance(claims, UserClaimSet) and isinstance(claims.subject, UserId):
            return AuthCredentials(), PhoenixUser(claims.subject, claims)
        return None


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
                claim = await self._token_store.read(Token(token))
                if not isinstance(claim, (AccessTokenClaims, ApiKeyClaims)):
                    break
                if claim.status is ClaimSetStatus.VALID and isinstance(claim.subject, UserId):
                    return await method(request_or_iterator, context)
                if claim.status is ClaimSetStatus.EXPIRED:
                    raise PermissionDenied(details="Token has expired")
                raise PermissionDenied()
        raise Unauthenticated()
