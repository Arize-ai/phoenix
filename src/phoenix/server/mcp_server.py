"""In-process MCP server mounted on the Phoenix FastAPI app.

This is the minimal mount: a `FastMCP` server that advertises **no tools** —
``initialize`` and ``tools/list`` work, and the tool list is empty. Its purpose
is to demonstrate the authentication chain end to end: an unauthenticated MCP
client is challenged with an HTTP 401 naming the protected-resource metadata
(RFC 9728), bootstraps the OAuth flow from it, and connects with the minted
bearer token. Tool surfaces can be layered on later without touching the auth
plumbing here.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import HTTPException
from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import PlainTextResponse

from phoenix.server.bearer_auth import is_authenticated
from phoenix.server.oauth2_authorization_server import public_origin
from phoenix.server.utils import prepend_root_path

if TYPE_CHECKING:
    from fastmcp.server.http import StarletteWithLifespan
    from starlette.types import ASGIApp, Receive, Scope, Send

#: Path the MCP ASGI app is mounted at on the Phoenix FastAPI app.
MCP_MOUNT_PATH = "/mcp"

#: Well-known path (RFC 9728 path-inserted form) serving the protected-resource
#: metadata for the MCP endpoint. Served by ``auth_md.py``; referenced here so the
#: 401 challenge and the metadata route cannot point at different documents.
MCP_PROTECTED_RESOURCE_METADATA_PATH = f"/.well-known/oauth-protected-resource{MCP_MOUNT_PATH}"


class MountPathNormalizer:
    """Pure-ASGI middleware that rewrites the bare mount path to the mount root.

    Starlette's ``Mount("/mcp")`` matches ``/mcp/...`` but not ``/mcp`` itself, and
    what falls through is swallowed by the SPA catch-all mounted at ``/`` (index.html
    for GET, 405 for POST) — yet ``<origin>/mcp`` is exactly the URL an MCP client is
    configured with. Rewriting the path (rather than redirecting) keeps single-request
    semantics for clients that do not follow redirects.

    The comparison must account for the deployment root path: when the reverse
    proxy forwards the prefix (``PHOENIX_HOST_ROOT_PATH=/phoenix``), the scope
    path for the bare mount is ``/phoenix/mcp``, not ``/mcp``.
    """

    def __init__(self, app: "ASGIApp") -> None:
        self._app = app

    async def __call__(self, scope: "Scope", receive: "Receive", send: "Send") -> None:
        if scope["type"] == "http" and scope.get("path") == prepend_root_path(
            scope, MCP_MOUNT_PATH
        ):
            path = f"{scope['path']}/"
            scope = {**scope, "path": path, "raw_path": path.encode()}
        await self._app(scope, receive, send)


class BearerAuthGuard:
    """ASGI wrapper that makes the mounted MCP app challenge unauthenticated callers.

    MCP clients bootstrap their entire OAuth flow from one signal: an HTTP 401 whose
    ``WWW-Authenticate`` header names the protected-resource metadata URL (RFC 9728).
    Phoenix enforces auth on ``/v1`` through a router dependency, which a mounted ASGI
    app never passes through — without this guard an unauthenticated ``initialize``
    succeeds and the failure surfaces only later, as opaque tool errors, so a client
    never learns it should run the OAuth flow.

    Only enforcement lives here: ``scope["user"]`` is already populated by the outer
    ``AuthenticationMiddleware`` (Starlette middleware wraps mounted apps), so the
    guard must only be installed when that middleware is — it delegates the actual
    check to the same ``is_authenticated`` used by the ``/v1`` routers.
    """

    def __init__(self, app: "ASGIApp") -> None:
        self._app = app

    async def __call__(self, scope: "Scope", receive: "Receive", send: "Send") -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return
        # Re-root the request at the outer app: by the time a mounted app runs,
        # root_path/path reflect the mount, which would corrupt base_url-derived URLs.
        request = Request({**scope, "root_path": "", "path": "/"})
        try:
            await is_authenticated(request)
        except HTTPException as exc:
            origin = public_origin(request)
            challenge = (
                f'Bearer realm="Arize Phoenix", '
                f'resource_metadata="{origin}{MCP_PROTECTED_RESOURCE_METADATA_PATH}"'
            )
            response = PlainTextResponse(
                str(exc.detail),
                status_code=exc.status_code,
                headers={"WWW-Authenticate": challenge},
            )
            await response(scope, receive, send)
            return
        await self._app(scope, receive, send)


def create_phoenix_mcp_app() -> "StarletteWithLifespan":
    """Build the (tool-less) MCP server and return its ASGI app.

    The returned app's lifespan (its streamable-HTTP session manager) must be
    entered by the caller; mounting alone will not start it.
    """
    mcp: FastMCP = FastMCP(name="Arize Phoenix")
    # path="/" because the app is mounted at MCP_MOUNT_PATH; the endpoint then
    # resolves to MCP_MOUNT_PATH itself rather than MCP_MOUNT_PATH + "/mcp".
    return mcp.http_app(path="/")
