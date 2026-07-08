"""
API-key scope attenuation.

A Phoenix API key may carry a ``scope`` claim signed into its JWT at mint
time. The claim is attenuation: the key's effective power is the
intersection of its owner's live role and the scope, so a scope can only
ever narrow access — never widen it. A key without a scope claim behaves
exactly as before (full legacy access), which is what makes the feature
safe to deploy: existing keys are unaffected, and the claim is covered by
the token signature, so a holder cannot strip it.

The scope vocabulary is public API the moment a customer mints a token
carrying it, so it is deliberately tiny:

- ``ingest`` — the key may only write trace data. Permitted surfaces:
    * gRPC OTLP trace export (the gRPC server serves only the OTLP
      ``TraceService``, so a valid scoped key passes as-is)
    * ``POST /v1/traces`` (HTTP OTLP trace export)
    * ``POST /v1/projects/{project_identifier}/spans`` (REST span creation)
  Everything else — all other REST routes, all of GraphQL, websockets —
  is denied with 403.

A scope value this module does not recognize (e.g. minted by a newer
Phoenix version) denies everything: fail closed.

Enforcement is a single chokepoint: ``ApiKeyScopeEnforcementMiddleware``
runs immediately inside the authentication middleware, sees every HTTP
and websocket request with the authenticated user already resolved, and
consults :func:`is_allowed_for_scope`. Route handlers never check scopes
themselves.
"""

import re
from typing import Any, Optional

from starlette.types import ASGIApp, Receive, Scope, Send

API_KEY_SCOPE_INGEST = "ingest"

KNOWN_API_KEY_SCOPES = frozenset({API_KEY_SCOPE_INGEST})

_INGEST_ROUTES: tuple[tuple[str, "re.Pattern[str]"], ...] = (
    ("POST", re.compile(r"^/v1/traces/?$")),
    ("POST", re.compile(r"^/v1/projects/[^/]+/spans/?$")),
)


def is_allowed_for_scope(scope_value: str, method: str, path: str) -> bool:
    """
    Decide whether a request may proceed under the given API-key scope.

    Unrecognized scope values deny everything (fail closed): a key minted
    by a newer server with a scope this version doesn't know must not
    fall back to full access.
    """
    if scope_value == API_KEY_SCOPE_INGEST:
        return any(
            method == allowed_method and pattern.match(path)
            for allowed_method, pattern in _INGEST_ROUTES
        )
    return False


def get_request_api_key_scope(user: Any) -> Optional[str]:
    """
    Extract the scope claim from an authenticated request user, or None if
    the request is not backed by a scoped API key (browser sessions, the
    admin secret, and unscoped keys all return None).
    """
    # Local imports avoid a circular dependency: bearer_auth has no need to
    # know about scopes, but this module needs its types to recognize them.
    from phoenix.server.bearer_auth import PhoenixSystemUser, PhoenixUser
    from phoenix.server.types import ApiKeyClaims

    if not isinstance(user, PhoenixUser) or isinstance(user, PhoenixSystemUser):
        return None
    claims = getattr(user, "claims", None)
    if not isinstance(claims, ApiKeyClaims) or claims.attributes is None:
        return None
    return claims.attributes.scope


class ApiKeyScopeEnforcementMiddleware:
    """
    Pure ASGI middleware enforcing API-key scope attenuation.

    Must be mounted inside (i.e. after) the authentication middleware so
    that ``scope["user"]`` is populated. Requests not bearing a scoped API
    key pass through untouched.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return
        key_scope = get_request_api_key_scope(scope.get("user"))
        if key_scope is None:
            await self.app(scope, receive, send)
            return
        path = scope.get("path", "")
        if scope["type"] == "http" and is_allowed_for_scope(
            key_scope, scope.get("method", ""), path
        ):
            await self.app(scope, receive, send)
            return
        await self._deny(scope, send, key_scope)

    @staticmethod
    async def _deny(scope: Scope, send: Send, key_scope: str) -> None:
        if scope["type"] == "websocket":
            await send({"type": "websocket.close", "code": 1008})
            return
        body = (
            f'{{"detail":"API key scope \'{key_scope}\' does not permit this request"}}'
        ).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 403,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})


def deny_unknown_grpc_scope(key_scope: Optional[str]) -> bool:
    """
    Whether a gRPC request bearing this API-key scope must be rejected.

    The gRPC server serves only the OTLP TraceService (ingest), so the
    ``ingest`` scope — and the absence of a scope — both pass. Anything
    else is an unrecognized scope and fails closed.
    """
    return key_scope is not None and key_scope != API_KEY_SCOPE_INGEST
