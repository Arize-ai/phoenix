"""
Endpoints for agent authentication discovery, following the auth.md
convention: https://workos.com/auth-md/docs/apps

Serves:
  GET|HEAD /auth.md                              -- human/agent-readable auth guide
  GET|HEAD /.well-known/oauth-protected-resource -- RFC 9728 Protected Resource Metadata
"""

from textwrap import dedent
from typing import Optional

from fastapi import APIRouter, HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse

from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
)
from phoenix.server.oauth2_authorization_server import public_origin

router = APIRouter(include_in_schema=False)


def _protected_resource_metadata(request: Request, *, resource: str) -> JSONResponse:
    origin = public_origin(request)
    # Only advertise an authorization server that actually answers: this is False
    # both when authentication is off and when the authorization server is
    # disabled by PHOENIX_ENABLE_OAUTH2_AUTHORIZATION_SERVER.
    authorization_server_enabled: bool = getattr(
        request.app.state, "oauth2_authorization_server_enabled", False
    )
    authorization_servers = [origin] if authorization_server_enabled else []
    return JSONResponse(
        {
            "resource": resource,
            "resource_name": "Arize Phoenix",
            "authorization_servers": authorization_servers,
            "bearer_methods_supported": ["header"],
            "resource_documentation": f"{origin}/auth.md",
        }
    )


# HEAD is listed explicitly on these routes: FastAPI, unlike Starlette's own
# Route, does not add HEAD to a GET route implicitly, and an unmatched HEAD
# falls through to the SPA mount at / and 404s. uvicorn omits the body for
# HEAD at the protocol layer, so handlers need no special casing.
@router.api_route("/.well-known/oauth-protected-resource", methods=["GET", "HEAD"])
async def protected_resource_metadata(request: Request) -> JSONResponse:
    return _protected_resource_metadata(request, resource=public_origin(request))


@router.api_route("/.well-known/oauth-protected-resource/mcp", methods=["GET", "HEAD"])
async def mcp_protected_resource_metadata(request: Request) -> JSONResponse:
    """RFC 9728 path-inserted metadata for the MCP endpoint mounted at /mcp.

    MCP clients derive this URL from the MCP server URL (and from the 401
    challenge emitted by the mount's auth guard) and expect ``resource`` to be
    the MCP endpoint itself, not the deployment origin.
    """
    # Set by create_app; None when the MCP server is not enabled, in which case
    # there is no such resource to describe. The route path is /mcp because the
    # mount path is the MCP_MOUNT_PATH constant; the state check keeps the two
    # from drifting silently if the constant ever changes.
    mount_path: Optional[str] = getattr(request.app.state, "mcp_mount_path", None)
    if mount_path != "/mcp":
        raise HTTPException(status_code=404)
    return _protected_resource_metadata(request, resource=f"{public_origin(request)}{mount_path}")


@router.api_route("/auth.md", methods=["GET", "HEAD"])
async def get_auth_md(request: Request) -> PlainTextResponse:
    base_url = public_origin(request)
    authentication_enabled: bool = getattr(request.app.state, "authentication_enabled", False)
    authorization_server_enabled: bool = getattr(
        request.app.state, "oauth2_authorization_server_enabled", False
    )
    content = _build_auth_md(
        base_url=base_url,
        authentication_enabled=authentication_enabled,
        authorization_server_enabled=authorization_server_enabled,
    )
    return PlainTextResponse(content, media_type="text/markdown; charset=utf-8")


def _build_auth_md(
    *,
    base_url: str,
    authentication_enabled: bool,
    authorization_server_enabled: bool,
) -> str:
    if not authentication_enabled:
        return dedent(f"""\
            # auth.md

            Arize Phoenix — AI observability & evaluation platform.

            This deployment is running **without authentication**. All endpoints are
            publicly accessible — no credentials are required.

            **Resource:** {base_url}
            **Protected Resource Metadata:** {base_url}/.well-known/oauth-protected-resource

            This document follows the [auth.md convention](https://workos.com/auth-md/docs/apps).
        """)

    if not authorization_server_enabled:
        return dedent(f"""\
            # auth.md

            Arize Phoenix — AI observability & evaluation platform.

            This deployment requires bearer-token authentication. Send an
            `Authorization: Bearer <token>` header on every request.

            **Resource:** {base_url}
            **Protected Resource Metadata:** {base_url}/.well-known/oauth-protected-resource

            Interactive OAuth2 login is disabled on this deployment. There is no
            authorization server to discover; obtain a credential through one of
            the mechanisms below.

            ## Obtain a credential

            - **API key**: created in the Phoenix UI under **Settings → API Keys**. API
              keys are recommended for long-lived, non-interactive integrations.
            - **Access token**: `POST {base_url}/auth/login` with JSON body
              `{{"email": "...", "password": "..."}}` sets a `{PHOENIX_ACCESS_TOKEN_COOKIE_NAME}`
              cookie usable as a bearer token. Renew an expired token via
              `POST {base_url}/auth/refresh` with the `{PHOENIX_REFRESH_TOKEN_COOKIE_NAME}` cookie.

            ## Use the credential

            ```
            GET {base_url}/v1/projects
            Authorization: Bearer <api-key-or-access-token>
            ```

            Requests without a valid token receive `401 Unauthorized` with a
            `WWW-Authenticate` challenge pointing at the Protected Resource Metadata
            above.

            ## Support

            For integration issues, open an issue at
            https://github.com/Arize-ai/phoenix/issues.

            This document follows the [auth.md convention](https://workos.com/auth-md/docs/apps).
        """)

    return dedent(f"""\
        # auth.md

        Arize Phoenix — AI observability & evaluation platform.

        This deployment requires bearer-token authentication. Send an
        `Authorization: Bearer <token>` header on every request.

        **Resource:** {base_url}
        **Protected Resource Metadata:** {base_url}/.well-known/oauth-protected-resource

        ## OAuth2 authorization code flow

        Phoenix exposes an OAuth2 authorization server for browser-based login to
        agent credentials:

        - Authorization endpoint: `GET {base_url}/oauth2/authorize`
        - Token endpoint: `POST {base_url}/oauth2/token`
        - Revocation endpoint: `POST {base_url}/oauth2/revoke`
        - Discovery: `GET {base_url}/.well-known/oauth-authorization-server`

        ## Obtain a credential

        - **OAuth2 access token**: use authorization code with PKCE. Tokens act
          with the permissions of the user who approved the authorization.
        - **API key**: created in the Phoenix UI under **Settings → API Keys**. API
          keys are recommended for long-lived, non-interactive integrations.
        - **Access token**: `POST {base_url}/auth/login` with JSON body
          `{{"email": "...", "password": "..."}}` sets a `{PHOENIX_ACCESS_TOKEN_COOKIE_NAME}`
          cookie usable as a bearer token. Renew an expired token via
          `POST {base_url}/auth/refresh` with the `{PHOENIX_REFRESH_TOKEN_COOKIE_NAME}` cookie.

        ## Use the credential

        ```
        GET {base_url}/v1/projects
        Authorization: Bearer <api-key-or-access-token>
        ```

        Requests without a valid token receive `401 Unauthorized` with a
        `WWW-Authenticate` challenge pointing at the Protected Resource Metadata
        above.

        ## Scopes

        Phoenix does not currently restrict OAuth2 credentials by scope. A token
        obtained through the authorization code flow carries the permissions of
        the user who approved it, including write operations permitted by that
        user's role.

        ## Support

        For integration issues, open an issue at
        https://github.com/Arize-ai/phoenix/issues.

        This document follows the [auth.md convention](https://workos.com/auth-md/docs/apps).
    """)
