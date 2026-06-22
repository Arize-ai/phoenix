"""
Endpoints for agent authentication discovery.

Serves:
  GET /auth.md                              -- human/agent-readable auth guide
  GET /.well-known/oauth-protected-resource -- RFC 9728 Protected Resource Metadata
"""

from textwrap import dedent

from fastapi import APIRouter
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse

router = APIRouter(tags=["auth"])


@router.get(
    "/.well-known/oauth-protected-resource",
    summary="Protected Resource Metadata (RFC 9728)",
    description=(
        "Returns OAuth 2.0 Protected Resource Metadata describing this Phoenix instance. "
        "Agents use this to discover bearer-token requirements and locate auth.md."
    ),
    include_in_schema=False,
)
async def protected_resource_metadata(request: Request) -> JSONResponse:
    base_url = str(request.base_url).rstrip("/")
    authentication_required: bool = getattr(request.app.state, "authentication_enabled", False)
    payload: dict = {
        "resource": base_url,
        "resource_name": "Arize Phoenix",
        "bearer_methods_supported": ["header"],
        "scopes_supported": [],
        "resource_documentation": f"{base_url}/auth.md",
    }
    if authentication_required:
        payload["authentication_required"] = True
    return JSONResponse(payload, media_type="application/json")


@router.get(
    "/auth.md",
    summary="Agent authentication guide",
    description=(
        "Returns a Markdown document describing how automated agents can authenticate "
        "with this Phoenix deployment."
    ),
    include_in_schema=False,
)
async def get_auth_md(request: Request) -> PlainTextResponse:
    base_url = str(request.base_url).rstrip("/")
    host = request.url.hostname or base_url
    authentication_enabled: bool = getattr(request.app.state, "authentication_enabled", False)
    content = _build_auth_md(
        base_url=base_url, host=host, authentication_enabled=authentication_enabled
    )
    return PlainTextResponse(content, media_type="text/markdown; charset=utf-8")


def _build_auth_md(*, base_url: str, host: str, authentication_enabled: bool) -> str:
    if not authentication_enabled:
        return dedent(f"""\
            # auth.md

            This Arize Phoenix deployment is running **without authentication**. All endpoints
            are publicly accessible — no credentials are required.

            **Resource:** {base_url}
            **Protected Resource Metadata:** {base_url}/.well-known/oauth-protected-resource
        """)

    return dedent(f"""\
        # auth.md

        This Arize Phoenix deployment requires bearer-token authentication. Every protected
        endpoint must include an `Authorization: Bearer <token>` header.

        **Resource server:** {base_url}
        **Protected Resource Metadata:** {base_url}/.well-known/oauth-protected-resource

        ---

        ## 1. Discover

        Send any request to a protected endpoint without credentials. Phoenix returns
        `401 Unauthorized` with a `WWW-Authenticate` header:

        ```
        WWW-Authenticate: Bearer realm="Arize Phoenix", resource_metadata="{base_url}/.well-known/oauth-protected-resource"
        ```

        Fetch the machine-readable metadata:

        ```http
        GET /.well-known/oauth-protected-resource HTTP/1.1
        Host: {host}
        ```

        Response fields:

        | Field | Description |
        |-------|-------------|
        | `resource` | Base URL of this Phoenix instance |
        | `resource_name` | `"Arize Phoenix"` |
        | `bearer_methods_supported` | `["header"]` |
        | `authentication_required` | `true` |
        | `resource_documentation` | URL of this file |

        ---

        ## 2. Pick a Method

        Phoenix issues two kinds of bearer credentials:

        | Credential | Best for | Expiry |
        |------------|----------|--------|
        | **API key** | Agents, automation, long-running scripts | Configurable (default: none) |
        | **Access token** | Interactive sessions, short-lived tasks | Configured TTL (default: 1 hour) |

        Use an **API key** for unattended agents. Use an **access token** when you have a
        user session and need a short-lived credential.

        ---

        ## 3. Register / Obtain Credentials

        ### Option A — API Key (recommended for agents)

        API keys are created by an admin via the Phoenix UI (**Settings → API Keys**) or via
        the GraphQL API. Once created, the key value is returned exactly once; store it
        securely.

        **Create a system API key (admin only):**

        ```http
        POST /graphql HTTP/1.1
        Host: {host}
        Content-Type: application/json
        Authorization: Bearer <admin_token>

        {{
          "query": "mutation CreateSystemApiKey($name: String!, $expiresAt: DateTime) {{ createSystemApiKey(input: {{name: $name, expiresAt: $expiresAt}}) {{ jwt apiKey {{ name createdAt expiresAt }} }} }}",
          "variables": {{"name": "my-agent-key"}}
        }}
        ```

        The `jwt` field in the response is the API key value — use it as the bearer token.

        ### Option B — Access Token (email/password login)

        ```http
        POST /auth/login HTTP/1.1
        Host: {host}
        Content-Type: application/json

        {{
          "email": "user@example.com",
          "password": "secret"
        }}
        ```

        On success Phoenix sets `Set-Cookie` headers (`phoenix.access_token`,
        `phoenix.refresh_token`). Extract the `phoenix.access_token` cookie value and send
        it as a bearer token, **or** pass the cookies directly on subsequent requests.

        ---

        ## 4. Use the Token

        Present the token in every request as a bearer credential:

        ```http
        GET /v1/traces HTTP/1.1
        Host: {host}
        Authorization: Bearer <api_key_or_access_token>
        ```

        The same token can be reused until it expires or is revoked.

        ---

        ## 5. Errors

        | Status | Detail | Meaning | Action |
        |--------|--------|---------|--------|
        | `401` | `Invalid token` | Token not recognised or malformed | Verify token value; re-authenticate |
        | `401` | `Expired token` | Access token has expired | Exchange refresh token or re-login |
        | `403` | — | Insufficient role | Use a token with admin privileges |

        ### Refresh an expired access token

        ```http
        POST /auth/refresh HTTP/1.1
        Host: {host}
        Cookie: phoenix.refresh_token=<refresh_token>
        ```

        Returns a new `phoenix.access_token` cookie. When the refresh token itself is expired
        or returns `401`, restart at step 3.

        ---

        ## 6. Revocation

        - **API keys** — delete from the Phoenix UI (Settings → API Keys) or via GraphQL
          `deleteApiKey` mutation. Takes effect immediately.
        - **Access tokens** — expire after their configured TTL (default: 1 hour). Call
          `GET /auth/logout` to revoke early.
        - **Refresh tokens** — expire after their configured TTL (default: 7 days).

        After revocation any bearer request returns `401 Invalid token`. Restart at step 3.
    """)
