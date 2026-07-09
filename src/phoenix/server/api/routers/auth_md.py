"""
Endpoints for agent authentication discovery, following the auth.md
convention: https://workos.com/auth-md/docs/apps

Serves:
  GET /auth.md                              -- human/agent-readable auth guide
  GET /.well-known/oauth-protected-resource -- RFC 9728 Protected Resource Metadata
"""

from textwrap import dedent

from fastapi import APIRouter
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse

from phoenix.server.oauth2_authorization_server import public_origin

router = APIRouter(include_in_schema=False)


@router.get("/.well-known/oauth-protected-resource")
async def protected_resource_metadata(request: Request) -> JSONResponse:
    resource = public_origin(request)
    authentication_enabled: bool = getattr(request.app.state, "authentication_enabled", False)
    authorization_servers = [resource] if authentication_enabled else []
    scopes_supported = ["read_only"] if authentication_enabled else []
    return JSONResponse(
        {
            "resource": resource,
            "resource_name": "Arize Phoenix",
            "authorization_servers": authorization_servers,
            "bearer_methods_supported": ["header"],
            "scopes_supported": scopes_supported,
            "resource_documentation": f"{resource}/auth.md",
        }
    )


@router.get("/auth.md")
async def get_auth_md(request: Request) -> PlainTextResponse:
    base_url = public_origin(request)
    authentication_enabled: bool = getattr(request.app.state, "authentication_enabled", False)
    content = _build_auth_md(base_url=base_url, authentication_enabled=authentication_enabled)
    return PlainTextResponse(content, media_type="text/markdown; charset=utf-8")


def _build_auth_md(*, base_url: str, authentication_enabled: bool) -> str:
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

    return dedent(f"""\
        # auth.md

        Arize Phoenix — AI observability & evaluation platform.

        This deployment requires bearer-token authentication. Send an
        `Authorization: Bearer <token>` header on every request.

        **Resource:** {base_url}
        **Protected Resource Metadata:** {base_url}/.well-known/oauth-protected-resource

        ## OAuth2 authorization code flow

        Phoenix exposes an OAuth2 authorization server for browser-based login to
        read-only agent credentials:

        - Authorization endpoint: `GET {base_url}/oauth2/authorize`
        - Token endpoint: `POST {base_url}/oauth2/token`
        - Revocation endpoint: `POST {base_url}/oauth2/revoke`
        - Discovery: `GET {base_url}/.well-known/oauth-authorization-server`

        ## Obtain a credential

        - **OAuth2 access token**: use authorization code with PKCE. Phoenix grants
          the `read_only` scope for this flow.
        - **API key**: created in the Phoenix UI under **Settings → API Keys**. API
          keys are still recommended for integrations that need write access.
        - **Access token**: `POST {base_url}/auth/login` with JSON body
          `{{"email": "...", "password": "..."}}` sets a `phoenix.access_token`
          cookie usable as a bearer token. Renew an expired token via
          `POST {base_url}/auth/refresh` with the `phoenix.refresh_token` cookie.

        ## Use the credential

        ```
        GET {base_url}/v1/projects
        Authorization: Bearer <api-key-or-access-token>
        ```

        Requests without a valid token receive `401 Unauthorized` with a
        `WWW-Authenticate` challenge pointing at the Protected Resource Metadata
        above.

        ## Scopes

        OAuth2 authorization-code credentials support `read_only`. Write operations
        require a credential with write privileges, such as an API key for a user or
        system role that can perform the requested action.

        ## Support

        For integration issues, open an issue at
        https://github.com/Arize-ai/phoenix/issues.

        This document follows the [auth.md convention](https://workos.com/auth-md/docs/apps).
    """)
