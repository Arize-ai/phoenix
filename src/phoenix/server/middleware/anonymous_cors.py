"""Wildcard, non-credentialed CORS for anonymous public endpoints.

Browser-based OAuth public clients (MCP hosts such as the MCP Inspector, or any
web app doing authorization-code + PKCE) fetch the discovery documents, register
via RFC 7591, and exchange codes at the token endpoint straight from the page,
so those endpoints must answer cross-origin requests from origins that cannot be
known in advance. Hosted authorization servers therefore serve
``Access-Control-Allow-Origin: *`` on exactly these surfaces, and that is safe
here for the same reason it is safe there: the endpoints carry no ambient
credentials (no cookies are honored), so there is no session for a hostile page
to ride — the flow's security rests on PKCE, single-use codes, and redirect-URI
binding, not on which origin fetched the endpoint.

This is deliberately not the global ``CORSMiddleware`` behind
``PHOENIX_ALLOWED_ORIGINS``: that one is a *credentialed* allowlist for the
cookie-authenticated app API, which must never be wildcarded. Endpoints that do
honor cookies (``/oauth2/authorize`` is navigated to, and the consent decision
endpoint enforces a strict Origin check) are excluded from this middleware's
path set on purpose.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, NamedTuple, Optional

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import PlainTextResponse

from phoenix.server.utils import strip_root_path

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

_PREFLIGHT_MAX_AGE_SECONDS = 600


class AnonymousPaths(NamedTuple):
    """The path set of the anonymous (cookie-free) OAuth/MCP surfaces.

    Built once per app by :func:`anonymous_paths` and consumed by everything
    that must treat these surfaces specially — ``AnonymousCorsMiddleware``
    (wildcard CORS) and the CSRF origin validator (bypass) — so no two
    consumers can classify a path differently.
    """

    exact: frozenset[str]
    prefixes: tuple[str, ...]

    def matches(self, scope: "Scope") -> bool:
        # Compare the root-path-relative route: when a reverse proxy forwards
        # the prefix (PHOENIX_HOST_ROOT_PATH), the scope path arrives as
        # /<root>/oauth2/token etc.
        route = strip_root_path(scope, scope.get("path", ""))
        return route in self.exact or route.startswith(self.prefixes)


def anonymous_paths(mcp_mount_path: Optional[str] = None) -> AnonymousPaths:
    mcp = (mcp_mount_path,) if mcp_mount_path is not None else ()
    return AnonymousPaths(
        exact=frozenset({"/oauth2/register", "/oauth2/token", "/oauth2/revoke", *mcp}),
        prefixes=("/.well-known/", *(f"{path}/" for path in mcp)),
    )


class AnonymousCorsMiddleware:
    def __init__(
        self,
        app: "ASGIApp",
        *,
        paths: AnonymousPaths,
        expose_headers: str = "",
    ) -> None:
        self._app = app
        self._paths = paths
        self._expose_headers = expose_headers

    async def __call__(self, scope: "Scope", receive: "Receive", send: "Send") -> None:
        if scope["type"] != "http" or not self._paths.matches(scope):
            await self._app(scope, receive, send)
            return
        request_headers = Headers(scope=scope)
        if "origin" not in request_headers:
            await self._app(scope, receive, send)
            return

        if scope["method"] == "OPTIONS" and "access-control-request-method" in request_headers:
            headers = {
                "access-control-allow-origin": "*",
                "access-control-allow-methods": "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT",
                "access-control-max-age": str(_PREFLIGHT_MAX_AGE_SECONDS),
            }
            # Echo the requested headers back: a wildcard would not cover
            # Authorization (the Fetch spec exempts it from `*`), and these
            # endpoints accept anonymous callers anyway.
            if requested := request_headers.get("access-control-request-headers"):
                headers["access-control-allow-headers"] = requested
            response = PlainTextResponse("OK", headers=headers)
            await response(scope, receive, send)
            return

        async def send_with_cors(message: "Message") -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["access-control-allow-origin"] = "*"
                # `*` must never be combined with credentials; drop any
                # credentialed grant an inner middleware may have added.
                del headers["access-control-allow-credentials"]
                if self._expose_headers:
                    headers["access-control-expose-headers"] = self._expose_headers
            await send(message)

        await self._app(scope, receive, send_with_cors)
