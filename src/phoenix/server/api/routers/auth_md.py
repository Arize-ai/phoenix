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

from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
)

router = APIRouter(include_in_schema=False)


@router.get("/.well-known/oauth-protected-resource")
async def protected_resource_metadata(request: Request) -> JSONResponse:
    base_url = str(request.base_url).rstrip("/")
    return JSONResponse(
        {
            "resource": base_url,
            "resource_name": "Arize Phoenix",
            # Phoenix issues its own credentials; there is no external
            # OAuth authorization server.
            "authorization_servers": [],
            "bearer_methods_supported": ["header"],
            "scopes_supported": [],
            "resource_documentation": f"{base_url}/auth.md",
        }
    )


@router.get("/auth.md")
async def get_auth_md(request: Request) -> PlainTextResponse:
    base_url = str(request.base_url).rstrip("/")
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

        ## Registration

        Phoenix does not implement the agent registration protocol (`/agent/identity`)
        or OAuth token exchange. Credentials are provisioned out of band, as described
        below.

        ## Obtain a credential

        - **API key** (recommended for agents): created in the Phoenix UI under
          **Settings → API Keys**. The key value is shown once at creation time;
          store it securely.
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

        Phoenix does not use OAuth scopes (`scopes_supported` is empty). Access is
        governed by the role of the user the credential belongs to.

        ## Support

        For integration issues, open an issue at
        https://github.com/Arize-ai/phoenix/issues.

        This document follows the [auth.md convention](https://workos.com/auth-md/docs/apps).
    """)
