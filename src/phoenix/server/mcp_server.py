"""In-process MCP server generated from Phoenix's REST API.

This builds a `FastMCP` server whose tools mirror every ``/v1`` REST endpoint and
returns an ASGI app that ``create_app`` mounts at :data:`MCP_MOUNT_PATH`. Tool
calls are dispatched back into the Phoenix FastAPI app in-process via an ASGI
transport (no network hop), so they pass through the same middleware stack that
guards the REST API. Because the tool surface is derived from the OpenAPI schema,
it stays in sync with the REST API automatically.

The internal dispatch does not replay the caller's bearer token. The MCP request
was already authenticated at the mount (``BearerAuthGuard``), so the dispatch
carries that authenticated principal directly in the internal request's ASGI
scope (see :class:`_InternalIdentityDispatch`), where ``BearerTokenAuthBackend``
recognizes it. This keeps the caller's token spendable only where it was
presented — a prerequisite for enforcing RFC 8707 audience at ``/v1``, since no
legitimate ``/v1`` traffic carries an ``/mcp``-audience token.

The ``/v1`` API has ~70 operations, which is far too many tools to advertise at
once without degrading tool selection and wasting context. So the server applies
*progressive disclosure*: tools are grouped by their REST router tag (``projects``,
``spans``, ``datasets``, ...); only :data:`_DEFAULT_VISIBLE_GROUPS` are advertised
initially, and a model reveals the rest on demand by calling ``enable_tool_group``.
Reveals are scoped to the calling session (FastMCP session-visibility rules), so
one client unlocking a group never affects another, and a ``tools/list_changed``
notification is emitted to that session automatically.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any, Callable, Optional

import httpx
from fastapi import HTTPException
from fastmcp import Context, FastMCP
from fastmcp.exceptions import ToolError
from fastmcp.experimental.transforms.code_mode import (
    CodeMode,
    GetSchemas,
    GetTags,
    GetToolCatalog,
    ListTools,
    MontySandboxProvider,
    Search,
)
from fastmcp.server.dependencies import get_http_request
from fastmcp.server.providers.openapi import MCPType, RouteMap
from fastmcp.tools.base import Tool
from mcp.types import ToolAnnotations
from starlette.requests import Request
from starlette.responses import PlainTextResponse

from phoenix.config import get_env_mcp_code_mode
from phoenix.server.bearer_auth import (
    INTERNAL_PRINCIPAL_SCOPE_KEY,
    PhoenixUser,
    authenticated_claims,
    token_audience_permits,
)
from phoenix.server.oauth2_authorization_server import public_origin
from phoenix.server.utils import prepend_root_path

if TYPE_CHECKING:
    from fastapi import FastAPI
    from fastmcp.server.http import StarletteWithLifespan
    from starlette.types import ASGIApp, Receive, Scope, Send

#: Path the MCP ASGI app is mounted at on the Phoenix FastAPI app.
MCP_MOUNT_PATH = "/mcp"

#: Tool groups (REST router tags) advertised before any progressive disclosure.
#: ``projects`` is the natural entry point — list projects, then unlock the data
#: groups (spans, traces, ...) for the project you care about. Every other group
#: is hidden until ``enable_tool_group`` reveals it for the session.
_DEFAULT_VISIBLE_GROUPS = frozenset({"projects"})

#: Tag applied to the progressive-disclosure meta tools so they are never gated.
_META_TAG = "phoenix-mcp-meta"

# Tools dispatch back into the Phoenix app via an ASGI transport, so this host is
# never resolved over the network; it only supplies a syntactically valid base URL.
_INTERNAL_BASE_URL = "http://phoenix-mcp.internal"

# A tool caller here is a non-deterministic model that can be steered by the data it
# reads, so the safety of a call cannot live in the model's judgement. It has to be
# legible to the *client*, which can then auto-approve harmless reads and require
# confirmation before state changes. Tool annotations carry exactly that signal, so we
# derive them from REST semantics: GET only reads; POST adds a new entity; PUT/PATCH
# modify an existing one; DELETE removes one. Every /v1 operation acts on Phoenix's own
# datastore, so none of them reach an "open world" of arbitrary external systems.
_ANNOTATIONS_BY_METHOD: dict[str, ToolAnnotations] = {
    "GET": ToolAnnotations(
        readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False
    ),
    "POST": ToolAnnotations(
        readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False
    ),
    "PUT": ToolAnnotations(
        readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False
    ),
    "PATCH": ToolAnnotations(
        readOnlyHint=False, destructiveHint=True, idempotentHint=False, openWorldHint=False
    ),
    "DELETE": ToolAnnotations(
        readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False
    ),
}

# An unrecognized verb is treated as the worst case — possibly mutating — so a client
# confirms rather than silently auto-approving something we could not classify.
_DEFAULT_ANNOTATIONS = ToolAnnotations(
    readOnlyHint=False, destructiveHint=True, openWorldHint=False
)

# The progressive-disclosure meta tools only read or adjust which tools are visible in
# the current session; they never touch Phoenix data, so a client may auto-approve them.
_META_ANNOTATIONS = ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=False)


_DOCSTRING_SECTION = re.compile(
    r"\n\s*(?:Args|Arguments|Parameters|Returns|Raises|Yields|Example[s]?|Note[s]?)\s*:",
)


def _agent_facing_description(route: Any, component: Any) -> Optional[str]:
    """A concise, agent-facing description for a generated tool.

    FastMCP builds the tool description from the OpenAPI ``description`` (the endpoint
    docstring) in preference to the ``summary``. Docstrings here are written for human
    API consumers: they carry ``Args:``/``Returns:`` sections and source indentation
    that are noise on a tool surface an agent pays for by the token. Prefer the route's
    curated one-line ``summary``; when absent, fall back to the first paragraph of the
    docstring with structured sections and indentation stripped.
    """
    summary = (getattr(route, "summary", "") or "").strip()
    if summary:
        return summary
    description = getattr(component, "description", None)
    if not description:
        return None
    lead = _DOCSTRING_SECTION.split(description, maxsplit=1)[0]
    paragraph = lead.strip().split("\n\n", 1)[0]
    collapsed = " ".join(line.strip() for line in paragraph.splitlines() if line.strip())
    return collapsed or None


def _strip_schema_titles(node: Any) -> None:
    """Recursively remove auto-generated ``title`` keys from a JSON schema.

    Pydantic stamps a ``title`` on every field (``"Sync"`` for ``sync``) that only
    repeats the property name. Across a catalog these dominate the schema an agent must
    read — one ``get_schema(detail="full")`` on two tools returned 512 ``title`` keys
    against 14 ``description`` keys. Types, enums, descriptions, and required markers
    are preserved.
    """
    if isinstance(node, dict):
        node.pop("title", None)
        for value in node.values():
            _strip_schema_titles(value)
    elif isinstance(node, list):
        for item in node:
            _strip_schema_titles(item)


def _annotate_from_rest_method(route: Any, component: Any) -> None:
    """Shape each generated tool for an agent audience.

    ``from_openapi`` calls this for every component it generates. All of the shaping is
    confined to the MCP surface; the human REST docs are untouched.

    1. Stamp read/destructive hints from the HTTP verb, so a destructive ``DELETE``
       does not look identical to a harmless ``GET`` to the client.
    2. Replace the docstring-derived description with a concise, agent-facing one drawn
       from the route summary (see :func:`_agent_facing_description`).
    3. Strip auto-generated Pydantic ``title`` noise from the input and output schemas.
    """
    if not hasattr(component, "annotations"):
        return
    method = str(getattr(route, "method", "")).upper()
    component.annotations = _ANNOTATIONS_BY_METHOD.get(method, _DEFAULT_ANNOTATIONS)

    if (description := _agent_facing_description(route, component)) is not None:
        component.description = description

    if isinstance(getattr(component, "parameters", None), dict):
        _strip_schema_titles(component.parameters)
    if isinstance(getattr(component, "output_schema", None), dict):
        _strip_schema_titles(component.output_schema)


def _current_mcp_principal() -> Optional[PhoenixUser]:
    """The authenticated user of the MCP request currently being served, if any.

    ``scope["user"]`` is populated by the outer ``AuthenticationMiddleware`` and
    verified by ``BearerAuthGuard`` before any tool runs; ``get_http_request``
    resolves that request from ambient context at dispatch time. Returns None when
    authentication is disabled (no middleware, so no user in the scope) or when
    there is no live HTTP request to inherit from — e.g. a background task, whose
    synthetic request snapshots only headers, never the authenticated principal.
    """
    try:
        request = get_http_request()
    except RuntimeError:
        return None
    user = request.scope.get("user")
    return user if isinstance(user, PhoenixUser) else None


class _InternalIdentityDispatch:
    """ASGI wrapper for the in-process MCP→/v1 hop: identity, not token replay.

    Tool calls dispatch into ``/v1`` as new requests, which must authenticate.
    Replaying the caller's bearer token would satisfy that, but dishonestly: the
    token's audience is ``/mcp``, and ``/v1`` would be accepting it as if the
    user's own client had presented it there — which forecloses ever enforcing
    audience at ``/v1``. Instead, the already-authenticated principal is placed
    directly in the internal request's ASGI scope, where
    ``BearerTokenAuthBackend`` accepts it. The scope is the right carrier because
    it is unforgeable from outside: external requests choose their headers, never
    their scope keys. The internal request itself carries no Authorization header
    (``get_http_headers`` strips it, and nothing re-adds it).

    Each MCP HTTP request re-authenticates at the mount, so the principal a tool
    call runs under is exactly as fresh as the borrowed token would have been.
    """

    def __init__(self, app: "ASGIApp") -> None:
        self._app = app

    async def __call__(self, scope: "Scope", receive: "Receive", send: "Send") -> None:
        if scope["type"] == "http" and (principal := _current_mcp_principal()) is not None:
            scope = {**scope, INTERNAL_PRINCIPAL_SCOPE_KEY: principal}
        await self._app(scope, receive, send)


def _v1_group_sizes(openapi_spec: dict[str, Any]) -> dict[str, int]:
    """Map each ``/v1`` router tag to the number of operations it contains."""
    sizes: dict[str, int] = {}
    for path, operations in openapi_spec.get("paths", {}).items():
        if not path.startswith("/v1"):
            continue
        for operation in operations.values():
            if not isinstance(operation, dict):
                continue
            for tag in operation.get("tags", []):
                sizes[tag] = sizes.get(tag, 0) + 1
    return sizes


def _install_progressive_disclosure(mcp: FastMCP, openapi_spec: dict[str, Any]) -> None:
    """Hide non-default tool groups and add meta tools to reveal them on demand."""
    group_sizes = _v1_group_sizes(openapi_spec)
    gated = {tag for tag in group_sizes if tag not in _DEFAULT_VISIBLE_GROUPS}
    if not gated:
        return

    # Hidden by default; ``enable_tool_group`` re-enables a group per session.
    mcp.disable(tags=gated)

    groups_doc = "\n".join(f"- {tag} ({group_sizes[tag]} tools)" for tag in sorted(gated))

    @mcp.tool(tags={_META_TAG}, annotations=_META_ANNOTATIONS)
    async def list_tool_groups() -> dict[str, Any]:
        """List the Phoenix tool groups that can be revealed for this session.

        Tools are grouped by domain. Only a small default set is visible up front;
        call ``enable_tool_group`` to reveal a group's tools before using them.
        """
        return {
            "visible_by_default": sorted(_DEFAULT_VISIBLE_GROUPS & set(group_sizes)),
            "available_to_enable": {tag: group_sizes[tag] for tag in sorted(gated)},
        }

    @mcp.tool(
        tags={_META_TAG},
        annotations=_META_ANNOTATIONS,
        description=(
            "Reveal a group of Phoenix tools for the current session, then use the "
            "newly available tools. Call this before using tools outside the default "
            f"set. Groups that can be enabled:\n{groups_doc}"
        ),
    )
    async def enable_tool_group(group: str, ctx: Context) -> str:
        if group not in gated:
            raise ToolError(
                f"Unknown tool group {group!r}. Groups that can be enabled: {sorted(gated)}."
            )
        await ctx.enable_components(tags={group})
        return f"Enabled the {group!r} tool group ({group_sizes[group]} tools) for this session."


def _read_only(
    factory: "Callable[[GetToolCatalog], Tool]",
) -> "Callable[[GetToolCatalog], Tool]":
    """Stamp read-only annotations on a code-mode discovery tool.

    The built-in discovery factories return unannotated tools; unannotated reads
    look identical to mutations, so a client cannot safely auto-approve them (the
    same legibility principle as ``_annotate_from_rest_method``).
    """

    def build(get_catalog: "GetToolCatalog") -> Tool:
        tool = factory(get_catalog)
        tool.annotations = _META_ANNOTATIONS
        return tool

    return build


def _build_code_mode() -> CodeMode:
    """Code-mode tool surface: discovery meta-tools plus a sandboxed ``execute``.

    Clients see ``search``/``get_schema``/``tags``/``list_tools`` for discovery and
    an ``execute`` tool that runs LLM-written Python in a pydantic-monty sandbox
    where ``call_tool(name, params)`` is the only function in scope. ``tags``
    browses the same REST router tags the group-gated surface uses, so both
    surfaces share one vocabulary. ``execute`` is deliberately left unannotated:
    it can invoke mutating tools, and an unannotated tool is treated as
    possibly-destructive by clients, which is the correct default.

    Sandbox bounds are the fastmcp defaults (30s wall clock, 100 MB memory, and
    at most 50 ``call_tool`` invocations per ``execute`` block) plus an explicit
    ``max_recursion_depth`` cap. The recursion cap is defense in depth against
    Monty's *counted* recursion path; it does not bound native re-entry stack
    growth (map/filter/sorted key callbacks re-entering the interpreter loop),
    which overflows the native stack before any counted limit trips — that class
    of crash is contained only by an out-of-process execution boundary.
    """
    return CodeMode(
        discovery_tools=[
            _read_only(Search()),
            _read_only(GetSchemas()),
            _read_only(GetTags()),
            _read_only(ListTools()),
        ],
        sandbox_provider=MontySandboxProvider(
            limits={
                "max_duration_secs": 30.0,
                "max_memory": 100_000_000,
                "max_recursion_depth": 200,
            },
        ),
    )


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
            claims = await authenticated_claims(request, websocket=False)
            # This mount is the /mcp protected resource. Accept tokens scoped to it
            # or to the deployment origin (and unscoped tokens: API keys, sessions);
            # reject a token minted for some other resource. The general
            # ``is_authenticated`` dependency does the mirror check at /v1, so an
            # /mcp-audience token is confined here and cannot be replayed there.
            if claims is not None:
                origin = public_origin(request)
                allowed = (origin, f"{origin}{MCP_MOUNT_PATH}")
                if not token_audience_permits(claims, allowed):
                    raise HTTPException(
                        status_code=401, detail="Token is not valid for the MCP resource"
                    )
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


def create_phoenix_mcp_app(app: "FastAPI") -> "StarletteWithLifespan":
    """Build the MCP server from ``app``'s REST API and return its ASGI app.

    The returned app's lifespan (its streamable-HTTP session manager) must be
    entered by the caller; mounting alone will not start it.
    """
    # Tool dispatch authenticates by principal passing, not token replay — see
    # ``_InternalIdentityDispatch``.
    client = httpx.AsyncClient(
        transport=httpx.ASGITransport(app=_InternalIdentityDispatch(app)),
        base_url=_INTERNAL_BASE_URL,
    )
    openapi_spec = app.openapi()
    mcp: FastMCP = FastMCP.from_openapi(
        openapi_spec=openapi_spec,
        client=client,
        name="Arize Phoenix",
        route_maps=[
            # Expose every REST endpoint under /v1 as a tool; exclude everything
            # else (GraphQL is mounted separately; health/version routes are not
            # useful to MCP clients).
            RouteMap(pattern=r"^/v1/", mcp_type=MCPType.TOOL),
            RouteMap(mcp_type=MCPType.EXCLUDE),
        ],
        # Make each tool's read/write nature legible to the client (see
        # ``_annotate_from_rest_method``); unannotated tools hide that a mutation is
        # a mutation.
        mcp_component_fn=_annotate_from_rest_method,
    )
    if get_env_mcp_code_mode():
        # Code mode replaces the tool surface wholesale: clients see only the
        # discovery meta-tools and ``execute``. Group gating must NOT be installed
        # with it — the code-mode catalog respects tool visibility, so gating would
        # hide every non-default group from ``search``/``list_tools`` with no way
        # to reveal them.
        mcp.add_transform(_build_code_mode())
    else:
        _install_progressive_disclosure(mcp, openapi_spec)
    # path="/" because the app is mounted at MCP_MOUNT_PATH; the endpoint then
    # resolves to MCP_MOUNT_PATH itself rather than MCP_MOUNT_PATH + "/mcp".
    return mcp.http_app(path="/")
