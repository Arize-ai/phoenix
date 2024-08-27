from typing import Any, Awaitable, Callable, Optional, Protocol, Tuple

import grpc
from grpc_interceptor import AsyncServerInterceptor
from grpc_interceptor.exceptions import Unauthenticated
from starlette.authentication import AuthCredentials, AuthenticationBackend, BaseUser
from starlette.requests import HTTPConnection

from phoenix.auth import PHOENIX_ACCESS_TOKEN_COOKIE_NAME, Claim, ClaimStatus, Token


class CanReadToken(Protocol):
    async def read(self, token: Token) -> Claim: ...


class BearerTokenAuthBackend(AuthenticationBackend):
    def __init__(self, token_store: CanReadToken) -> None:
        self.token_store = token_store

    async def authenticate(
        self,
        conn: HTTPConnection,
    ) -> Optional[Tuple[AuthCredentials, BaseUser]]:
        if header := conn.headers.get("Authorization"):
            scheme, _, token = header.partition(" ")
            if scheme.lower() != "bearer":
                return None
        elif cookie := conn.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME):
            token = cookie
        else:
            return None
        claim = await self.token_store.read(token)
        if claim.user_id is None:
            return None
        return AuthCredentials(), PhoenixUser(claim)


class PhoenixUser(BaseUser):
    def __init__(self, claim: Claim) -> None:
        self.claim = claim

    @property
    def is_authenticated(self) -> bool:
        return self.claim.status is ClaimStatus.VALID


class ApiKeyInterceptor(AsyncServerInterceptor):
    def __init__(self, token_store: CanReadToken) -> None:
        super().__init__()
        self._token_store = token_store

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
                if scheme.lower() != "bearer":
                    break
                claim = await self._token_store.read(token)
                if claim.status is ClaimStatus.VALID:
                    return await method(request_or_iterator, context)
                break
        raise Unauthenticated(status_code=grpc.StatusCode.UNAUTHENTICATED)
