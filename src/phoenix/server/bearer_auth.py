from abc import ABC
from collections.abc import Awaitable, Callable, Collection
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

#: ASGI scope key under which in-process dispatch (the mounted MCP server calling
#: back into /v1) places the caller's already-authenticated principal. Scope
#: entries have no wire representation — an external request can choose its
#: headers but never its scope keys — so the presence of this key proves the
#: request was constructed inside this process.
INTERNAL_PRINCIPAL_SCOPE_KEY = "phoenix.internal.principal"


class HasTokenStore(ABC):
    def __init__(self, token_store: CanReadToken) -> None:
        super().__init__()
        self._token_store = token_store


class BearerTokenAuthBackend(HasTokenStore, AuthenticationBackend):
    async def authenticate(
        self,
        conn: HTTPConnection,
    ) -> Optional[tuple[AuthCredentials, BaseUser]]:
        # In-process dispatch carries the principal that was already authenticated
        # at the outer request; accepting it directly (instead of replaying the
        # caller's bearer token) keeps the outer token's audience meaningful — the
        # internal request is attributed to the acting user without pretending
        # their token was presented here.
        if isinstance((principal := conn.scope.get(INTERNAL_PRINCIPAL_SCOPE_KEY)), PhoenixUser):
            return AuthCredentials(), principal
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
                # OTLP ingest is a write. Viewer-role tokens are authenticated but
                # not authorized to write — reject with PERMISSION_DENIED (not
                # UNAUTHENTICATED).
                if claims.attributes is not None and claims.attributes.user_role == "VIEWER":
                    await context.abort(grpc.StatusCode.PERMISSION_DENIED)
                    return
                return await method(request_or_iterator, context)
        await context.abort(grpc.StatusCode.UNAUTHENTICATED)


def token_audience_permits(claims: UserClaimSet, allowed_resources: Collection[str]) -> bool:
    """RFC 8707 audience confinement, enforced at resource-access time.

    A token that names no resource (``audience`` is falsy — web-session tokens,
    API keys, and OAuth2 access tokens minted without a resource indicator) is
    unscoped and valid at every resource. A token that names one or more
    resources is valid only where one of them appears in ``allowed_resources``.

    This is the access-time half of RFC 8707: the authorization server binds the
    audience at issuance, and each resource server checks the presented token was
    minted for it. Without this check an ``/mcp``-audience token would still
    authenticate at ``/v1``, since token validity alone does not restrict where a
    token may be spent.
    """
    audience = getattr(claims, "audience", None)
    if not audience:
        return True
    return any(resource in audience for resource in allowed_resources)


async def authenticated_claims(conn: HTTPConnection, *, websocket: bool) -> Optional[UserClaimSet]:
    """Identity and token-status validation shared by the ``/v1`` dependency and
    the ``/mcp`` guard.

    Returns the connection's claims, or ``None`` for the system user (which
    carries no token and no audience). Raises 401 when the connection is
    unauthenticated, expired, or otherwise invalid. Audience confinement is left
    to the caller, because the acceptable resource differs by endpoint.
    """
    if not isinstance((user := conn.user), PhoenixUser):
        if websocket:
            raise WebSocketException(code=401, reason="Invalid token")
        raise HTTPException(status_code=401, detail="Invalid token")
    if isinstance(user, PhoenixSystemUser):
        return None
    claims = user.claims
    if claims.status is ClaimSetStatus.EXPIRED:
        if websocket:
            raise WebSocketException(code=401, reason="Expired token")
        raise HTTPException(status_code=401, detail="Expired token")
    if claims.status is not ClaimSetStatus.VALID:
        if websocket:
            raise WebSocketException(code=401, reason="Invalid token")
        raise HTTPException(status_code=401, detail="Invalid token")
    return claims


def _deployment_origin(conn: HTTPConnection) -> str:
    # Lazy import: oauth2_authorization_server pulls in request-scoped helpers and
    # importing it at module load risks a cycle. public_origin is env- or
    # base_url-derived and cheap, and modules are cached after first import.
    from phoenix.server.oauth2_authorization_server import public_origin

    return public_origin(conn)  # type: ignore[arg-type]  # accepts any HTTPConnection


async def is_authenticated(
    # fastapi dependencies require non-optional types
    request: Request = cast(Request, None),
    websocket: WebSocket = cast(WebSocket, None),
) -> None:
    """
    Raises a 401 if the request or websocket connection is not authenticated.

    Beyond identity and token status, this enforces RFC 8707 audience confinement
    against the deployment-origin resource: a token minted for a sub-resource
    (e.g. the ``/mcp`` endpoint) is rejected here, so an ``/mcp``-audience token
    cannot be replayed against ``/v1`` or any other origin-scoped surface.

    In-process principal-passing dispatch — the mounted MCP server calling back
    into ``/v1`` — is exempt: those requests carry ``INTERNAL_PRINCIPAL_SCOPE_KEY``
    and were already audience-checked at the ``/mcp`` guard, and the principal they
    forward legitimately carries the ``/mcp`` audience.
    """
    assert request or websocket
    conn: HTTPConnection = request if request is not None else websocket
    is_websocket = request is None
    claims = await authenticated_claims(conn, websocket=is_websocket)
    # Only resource-scoped tokens can fail confinement, so derive the origin (and
    # exempt internal dispatch) only when the token actually names an audience —
    # unscoped tokens (the common case) skip the origin computation entirely.
    if (
        claims is not None
        and getattr(claims, "audience", None)
        and INTERNAL_PRINCIPAL_SCOPE_KEY not in conn.scope
        and not token_audience_permits(claims, (_deployment_origin(conn),))
    ):
        if is_websocket:
            raise WebSocketException(code=401, reason="Token is not valid for this resource")
        raise HTTPException(status_code=401, detail="Token is not valid for this resource")


async def create_access_and_refresh_tokens(
    *,
    token_store: TokenStore,
    user: models.User,
    access_token_expiry: timedelta,
    refresh_token_expiry: timedelta,
    grant_id: Optional[int] = None,
    scopes: Optional[tuple[str, ...]] = None,
    audience: Optional[tuple[str, ...]] = None,
) -> tuple[AccessToken, RefreshToken]:
    """Mint a paired access/refresh token.

    When ``grant_id`` is set the tokens are linked to an OAuth2 grant and carry a
    denormalized ``scopes`` snapshot, plus an ``audience`` snapshot (the RFC 8707
    resource the grant was authorized for) when one was requested. Web-session
    callers leave all three unset so behavior is unchanged.
    """
    if grant_id is not None and scopes is None:
        raise ValueError("scopes are required when minting tokens under an OAuth2 grant")
    issued_at = datetime.now(timezone.utc)
    user_id = UserId(user.id)
    user_role = user.role.name
    refresh_token_claims = RefreshTokenClaims(
        subject=user_id,
        audience=audience,
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
        audience=audience,
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
