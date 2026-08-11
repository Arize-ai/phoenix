"""Integration tests for the MCP mount's OAuth2 wiring.

An MCP host discovers and authorizes against Phoenix in three steps, each covered
here against a real server process: (1) an unauthenticated request to /mcp gets an
HTTP 401 whose WWW-Authenticate header names the protected-resource metadata — the
signal MCP clients bootstrap their OAuth flow from; (2) the path-inserted RFC 9728
document describes /mcp as the resource and Phoenix as its authorization server;
(3) the authorization-code flow accepts the MCP endpoint as an RFC 8707 resource
indicator, and the minted token authorizes real MCP tool calls end to end. The
resource indicator is also binding: a code or grant authorized for /mcp cannot be
redeemed or refreshed for a different resource.

These tests run against the package-scoped ``_app`` (which enables the MCP mount —
see the package ``_env`` fixture), so they execute on the same database backend as
the rest of the suite (SQLite or PostgreSQL per ``CI_TEST_DB_BACKEND``).
"""

from __future__ import annotations

from secrets import token_hex
from typing import Any, Iterator, cast
from urllib.parse import parse_qs, urlparse

import pytest
from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport

from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from tests.integration._helpers import (
    _ADMIN,
    _MEMBER,
    _VIEWER,
    _AppInfo,
    _get_ssl_context,
    _GetUser,
    _httpx_client,
    _server,
)

from .conftest import _oauth2_app_env, _OAuthPublicClient


def _base_url(app: _AppInfo) -> str:
    return app.base_url.rstrip("/")


def _register_public_client(app: _AppInfo, *, resource: str | None = None) -> _OAuthPublicClient:
    name = f"MCP test client {token_hex(4)}"
    redirect_uri = "http://127.0.0.1:8765/callback"
    response = _httpx_client(app).post(
        "oauth2/register",
        json={"client_name": name, "redirect_uris": [redirect_uri]},
    )
    response.raise_for_status()
    return _OAuthPublicClient(
        client_id=response.json()["client_id"],
        name=name,
        redirect_uri=redirect_uri,
        app=app,
        resource=resource,
    )


def _mcp_token_for(app: _AppInfo, get_user: _GetUser, role: UserRoleInput) -> str:
    """Mint an MCP-scoped access token for a fresh user with ``role``."""
    oauth_client = _register_public_client(app, resource=f"{_base_url(app)}/mcp")
    user = get_user(app, role).log_in(app)
    return cast(str, oauth_client.complete_flow(user)["access_token"])


def _mcp_transport(app: _AppInfo, access_token: str) -> StreamableHttpTransport:
    return StreamableHttpTransport(
        f"{_base_url(app)}/mcp",
        headers={"Authorization": f"Bearer {access_token}"},
        # The package app may serve TLS with a test-only certificate; trust it
        # the same way _httpx_client does.
        verify=_get_ssl_context(app.env) or False,
    )


class TestMcpAuthChallenge:
    @pytest.mark.parametrize("token", [None, "not-a-valid-token"], ids=["missing", "invalid"])
    def test_unauthenticated_initialize_receives_oauth_challenge(
        self,
        token: str | None,
        _app: _AppInfo,
    ) -> None:
        headers = {"Accept": "application/json, text/event-stream"}
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"

        response = _httpx_client(_app).post(
            "mcp",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "test", "version": "0"},
                },
            },
            headers=headers,
        )

        assert response.status_code == 401
        challenge = response.headers["www-authenticate"]
        assert challenge.startswith("Bearer ")
        prm_url = f"{_base_url(_app)}/.well-known/oauth-protected-resource/mcp"
        assert f'resource_metadata="{prm_url}"' in challenge


class TestMcpProtectedResourceMetadata:
    def test_path_inserted_document_describes_the_mcp_resource(
        self,
        _app: _AppInfo,
    ) -> None:
        response = _httpx_client(_app).get(".well-known/oauth-protected-resource/mcp")

        response.raise_for_status()
        metadata = response.json()
        assert metadata["resource"] == f"{_base_url(_app)}/mcp"
        assert metadata["authorization_servers"] == [_base_url(_app)]

    def test_absent_when_mcp_server_is_disabled(self, _app_dcr_disabled: _AppInfo) -> None:
        # _app_dcr_disabled sets PHOENIX_ENABLE_MCP_SERVER=false explicitly (its DCR
        # dial is otherwise unrelated).
        response = _httpx_client(_app_dcr_disabled).get(".well-known/oauth-protected-resource/mcp")

        assert response.status_code == 404


class TestMcpResourceIndicator:
    async def test_flow_with_mcp_resource_mints_token_that_authorizes_tool_calls(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        mcp_url = f"{_base_url(_app)}/mcp"
        oauth_client = _register_public_client(_app, resource=mcp_url)
        user = _get_user(_app, _MEMBER).log_in(_app)

        # `resource` is sent on both the authorize and token requests, the way a
        # spec-following MCP client would.
        token_response = oauth_client.complete_flow(user)

        transport = StreamableHttpTransport(
            mcp_url,
            headers={"Authorization": f"Bearer {token_response['access_token']}"},
            # The package app may serve TLS with a test-only certificate; trust it
            # the same way _httpx_client does.
            verify=_get_ssl_context(_app.env) or False,
        )
        async with Client(transport) as mcp_client:
            tool_names = {tool.name for tool in await mcp_client.list_tools()}
            assert "getProjects" in tool_names  # the default-visible tool group
            result = await mcp_client.call_tool("getProjects", {})
        # The tool call dispatched in-process to GET /v1/projects under the granted
        # user's identity; the database contains the "default" project.
        text = "".join(getattr(block, "text", "") for block in result.content)
        assert '"default"' in text

    async def test_mcp_audience_token_is_rejected_at_v1(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        """RFC 8707 audience confinement at access time: a token minted for the
        /mcp resource authenticates at /mcp but must be rejected if presented
        directly to the /v1 REST API, so it cannot be replayed against the broader
        surface. Audience is bound at issuance; this asserts it is also enforced at
        the resource server, not only at the token endpoint."""
        mcp_url = f"{_base_url(_app)}/mcp"
        oauth_client = _register_public_client(_app, resource=mcp_url)
        user = _get_user(_app, _MEMBER).log_in(_app)
        access_token = oauth_client.complete_flow(user)["access_token"]

        # The token is valid at the resource it was minted for.
        transport = StreamableHttpTransport(
            mcp_url,
            headers={"Authorization": f"Bearer {access_token}"},
            verify=_get_ssl_context(_app.env) or False,
        )
        async with Client(transport) as mcp_client:
            assert await mcp_client.list_tools()

        # The same otherwise-valid token is rejected at /v1: its audience is /mcp.
        response = _httpx_client(_app).get(
            "v1/projects", headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 401

    async def test_unscoped_token_is_accepted_at_v1(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        """Regression: a token minted with no resource indicator is unscoped and
        must still authenticate at /v1 — audience confinement rejects only tokens
        bound to a different resource, never unscoped tokens (API keys, sessions,
        plain OAuth access tokens)."""
        oauth_client = _register_public_client(_app)
        user = _get_user(_app, _MEMBER).log_in(_app)
        access_token = oauth_client.complete_flow(user)["access_token"]

        response = _httpx_client(_app).get(
            "v1/projects", headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 200

    def test_code_authorized_for_mcp_cannot_mint_tokens_for_another_resource(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        """RFC 8707: the audience is fixed at authorization. Exchanging a code that
        was authorized for /mcp while naming a different (individually valid)
        resource must fail rather than mint tokens labeled for the other resource."""
        mcp_url = f"{_base_url(_app)}/mcp"
        oauth_client = _register_public_client(_app, resource=mcp_url)
        user = _get_user(_app, _MEMBER).log_in(_app)
        params = oauth_client.authorize(user)
        redirect_to = oauth_client.decide(user, params)
        code = parse_qs(urlparse(redirect_to).query)["code"][0]

        response = _httpx_client(_app).post(
            "oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": oauth_client.client_id,
                "redirect_uri": oauth_client.redirect_uri,
                "code_verifier": oauth_client.code_verifier,
                # The deployment origin is a valid resource on its own, but it is
                # not the resource this code was authorized for.
                "resource": _base_url(_app),
            },
        )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_target"

    def test_code_authorized_without_resource_cannot_be_exchanged_for_mcp(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        """The audience is fixed at authorization: a code authorized with no
        resource indicator must not be widened at exchange into an MCP-labeled
        grant by naming /mcp only on the token request."""
        oauth_client = _register_public_client(_app)
        user = _get_user(_app, _MEMBER).log_in(_app)
        params = oauth_client.authorize(user)
        redirect_to = oauth_client.decide(user, params)
        code = parse_qs(urlparse(redirect_to).query)["code"][0]

        response = _httpx_client(_app).post(
            "oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": oauth_client.client_id,
                "redirect_uri": oauth_client.redirect_uri,
                "code_verifier": oauth_client.code_verifier,
                # A valid resource on its own, but the authorization named none.
                "resource": f"{_base_url(_app)}/mcp",
            },
        )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_target"

    def test_refresh_cannot_retarget_the_grant(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        """The grant's audience is immutable: refreshing with a different resource
        is rejected, and the rejection must not consume the refresh token."""
        mcp_url = f"{_base_url(_app)}/mcp"
        oauth_client = _register_public_client(_app, resource=mcp_url)
        user = _get_user(_app, _MEMBER).log_in(_app)
        token_response = oauth_client.complete_flow(user)

        def _refresh(resource: str | None) -> Any:
            data = {
                "grant_type": "refresh_token",
                "refresh_token": token_response["refresh_token"],
                "client_id": oauth_client.client_id,
            }
            if resource is not None:
                data["resource"] = resource
            return _httpx_client(_app).post("oauth2/token", data=data)

        mismatched = _refresh(_base_url(_app))
        assert mismatched.status_code == 400
        assert mismatched.json()["error"] == "invalid_target"

        # The failed attempt did not consume the token; a matching refresh works.
        matched = _refresh(mcp_url)
        assert matched.status_code == 200
        assert matched.json()["access_token"]

    def test_refresh_cannot_widen_a_null_audience_grant(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        """A grant authorized with no resource indicator admits none at refresh:
        naming /mcp there must fail rather than return a token for a grant that
        was never authorized for the MCP resource."""
        oauth_client = _register_public_client(_app)
        user = _get_user(_app, _MEMBER).log_in(_app)
        token_response = oauth_client.complete_flow(user)

        def _refresh(resource: str | None) -> Any:
            data = {
                "grant_type": "refresh_token",
                "refresh_token": token_response["refresh_token"],
                "client_id": oauth_client.client_id,
            }
            if resource is not None:
                data["resource"] = resource
            return _httpx_client(_app).post("oauth2/token", data=data)

        widened = _refresh(f"{_base_url(_app)}/mcp")
        assert widened.status_code == 400
        assert widened.json()["error"] == "invalid_target"

        # The failed attempt did not consume the token; a plain refresh works.
        plain = _refresh(None)
        assert plain.status_code == 200
        assert plain.json()["access_token"]

    def test_foreign_resource_is_rejected_at_authorization(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        oauth_client = _register_public_client(_app, resource=f"{_base_url(_app)}/graphql")
        user = _get_user(_app, _MEMBER).log_in(_app)

        response = _httpx_client(_app, user).get(
            "oauth2/authorize",
            params=oauth_client.authorization_params(),
            follow_redirects=False,
        )

        # A request-shape error is delivered to the redirect URI per RFC 6749
        # §4.1.2.1 so the client can correct and retry.
        assert response.status_code == 302
        location = response.headers["location"]
        assert location.startswith(oauth_client.redirect_uri)
        assert parse_qs(urlparse(location).query)["error"] == ["invalid_target"]


class TestMcpToolAuthorization:
    """The generated tool surface must enforce the caller's role, not merely hide tools.

    Every ``/v1`` route is exposed as a tool, and a tool call dispatches in-process to
    ``/v1`` carrying the caller's authenticated principal (``_InternalIdentityDispatch``
    in ``mcp_server.py``). An admin-gated route (``Depends(require_admin)``) must
    therefore still ``403`` a member reached through its tool. Progressive disclosure
    hides the admin ``users`` group, but hiding is not authorization: any caller may
    reveal it with ``enable_tool_group``, so ``require_admin`` on the dispatched
    principal is the real backstop. A member receiving the user list here would be a
    confused-deputy privilege escalation through ``/mcp`` — the audit's highest-ranked,
    previously untested claim.
    """

    @pytest.mark.parametrize(
        "role, is_admin",
        [(_ADMIN, True), (_MEMBER, False), (_VIEWER, False)],
        ids=["admin", "member", "viewer"],
    )
    async def test_admin_gated_tool_enforces_caller_role(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
        role: UserRoleInput,
        is_admin: bool,
    ) -> None:
        token = _mcp_token_for(_app, _get_user, role)
        async with Client(_mcp_transport(_app, token)) as mcp_client:
            # Reveal the admin ``users`` group the way any caller can. This is a
            # surface reveal, not an authorization grant — it only makes ``getUsers``
            # callable so that any denial below must come from ``require_admin`` at
            # the route, not from the tool being hidden.
            await mcp_client.call_tool("enable_tool_group", {"group": "users"})
            # getUsers == GET /v1/users, gated by require_admin.
            result = await mcp_client.call_tool("getUsers", {}, raise_on_error=False)

        text = "".join(getattr(block, "text", "") for block in (result.content or []))
        if is_admin:
            # Positive control: the admin is allowed, proving the tool works and the
            # route is a genuine privilege gate rather than broken for everyone.
            assert not result.is_error, f"admin was denied getUsers: {text}"
            assert '"role"' in text  # the users payload carries each user's role
        else:
            # A non-admin (member or viewer) must be denied by require_admin on the
            # dispatched principal. A non-error result — the admin-only user list — is
            # privilege escalation.
            assert result.is_error, f"{role} reached admin-only getUsers via /mcp: {text}"
            assert '"email"' not in text and '"role"' not in text, text

    @pytest.mark.parametrize(
        "role, is_viewer", [(_MEMBER, False), (_VIEWER, True)], ids=["member", "viewer"]
    )
    async def test_viewer_write_restriction_is_enforced(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
        role: UserRoleInput,
        is_viewer: bool,
    ) -> None:
        """Viewers are read-only, so a viewer must not perform a mutation through a
        tool that ``/v1`` would ``403``.

        ``deleteAnnotationConfig`` == ``DELETE /v1/annotation_configs/{id}``, which
        ``restrict_access_by_viewers`` blocks for viewers before the handler runs. A
        viewer is ``403``'d; a member passes that check and only then fails on the
        fake id (``422``). The distinguishing signal is therefore ``403`` versus
        not-``403`` — a viewer reaching past the ``403`` would be a read-only user
        mutating through ``/mcp``.
        """
        token = _mcp_token_for(_app, _get_user, role)
        async with Client(_mcp_transport(_app, token)) as mcp_client:
            await mcp_client.call_tool("enable_tool_group", {"group": "annotation_configs"})
            # A fake id: a viewer is blocked before it is inspected; a member reaches
            # the id-format check and gets 422.
            result = await mcp_client.call_tool(
                "deleteAnnotationConfig", {"config_id": "fake-id"}, raise_on_error=False
            )

        text = "".join(getattr(block, "text", "") for block in (result.content or []))
        assert result.is_error, text  # both roles error; the reason differs by role
        lowered = text.lower()
        if is_viewer:
            assert "403" in text or "forbidden" in lowered, f"viewer not blocked on write: {text}"
        else:
            assert "403" not in text and "forbidden" not in lowered, (
                f"member wrongly blocked: {text}"
            )


@pytest.fixture(scope="module")
def _app_mcp_code_mode(
    _ports: Iterator[int],
    tmp_path_factory: pytest.TempPathFactory,
) -> Iterator[_AppInfo]:
    """A server with auth, the /mcp mount, and PHOENIX_ENABLE_MCP_CODE_MODE all enabled.

    Code mode replaces the tool surface, so it cannot share the package app.
    SQLite only: the code-mode surface is request plumbing over the same /v1
    paths the package app already exercises on both backends.
    """
    env = _oauth2_app_env(
        port=next(_ports),
        grpc_port=next(_ports),
        database=str(tmp_path_factory.mktemp("oauth2_mcp_code_mode") / "phoenix.db"),
        extra={
            "PHOENIX_ENABLE_MCP_SERVER": "true",
            "PHOENIX_ENABLE_MCP_CODE_MODE": "true",
            "PHOENIX_DISABLE_RATE_LIMIT": "true",
        },
    )
    with _server(_AppInfo(env)) as app:
        yield app


class TestMcpCodeMode:
    async def test_oauth_token_drives_sandboxed_execute_end_to_end(
        self,
        _app_mcp_code_mode: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        """The full code-mode chain under auth: OAuth token -> discovery meta-tools
        -> execute -> sandboxed call_tool -> in-process /v1 dispatch. If the
        caller's authenticated identity did not propagate into the sandbox's tool
        calls, the /v1 dispatch would 401 and execute would fail."""
        app = _app_mcp_code_mode
        mcp_url = f"{_base_url(app)}/mcp"
        oauth_client = _register_public_client(app, resource=mcp_url)
        user = _get_user(app, _MEMBER).log_in(app)
        token_response = oauth_client.complete_flow(user)

        transport = StreamableHttpTransport(
            mcp_url,
            headers={"Authorization": f"Bearer {token_response['access_token']}"},
            verify=_get_ssl_context(app.env) or False,
        )
        async with Client(transport) as mcp_client:
            tool_names = {tool.name for tool in await mcp_client.list_tools()}
            assert tool_names == {"search", "get_schema", "tags", "list_tools", "execute"}

            result = await mcp_client.call_tool(
                "execute",
                {"code": 'return await call_tool("getProjects", {})'},
            )
        text = "".join(getattr(block, "text", "") for block in result.content)
        assert '"default"' in text

    @pytest.mark.parametrize(
        "role, is_admin",
        [(_ADMIN, True), (_MEMBER, False), (_VIEWER, False)],
        ids=["admin", "member", "viewer"],
    )
    async def test_execute_call_tool_enforces_caller_role(
        self,
        _app_mcp_code_mode: _AppInfo,
        _get_user: _GetUser,
        role: UserRoleInput,
        is_admin: bool,
    ) -> None:
        """Code Mode's sandboxed ``call_tool`` must not widen the caller's authority.

        A non-admin reaching an admin-gated route through ``execute`` -> ``call_tool``
        must be denied the same ``require_admin`` ``403`` as the direct dispatch. A
        non-admin receiving the user list is privilege escalation through the sandbox,
        which is why this pairs with ``TestMcpToolAuthorization`` for the direct path.
        """
        app = _app_mcp_code_mode
        token = _mcp_token_for(app, _get_user, role)
        async with Client(_mcp_transport(app, token)) as mcp_client:
            # getUsers == GET /v1/users, gated by require_admin.
            result = await mcp_client.call_tool(
                "execute",
                {"code": 'return await call_tool("getUsers", {})'},
                raise_on_error=False,
            )
        text = "".join(getattr(block, "text", "") for block in (result.content or []))
        if is_admin:
            assert not result.is_error, f"admin execute was denied getUsers: {text}"
            assert '"role"' in text  # the users payload carries each user's role
        else:
            # The in-sandbox call must be denied; it must NOT return the user list.
            assert result.is_error, f"{role} escalated to getUsers via execute: {text}"
            assert '"email"' not in text and '"role"' not in text, text

    @pytest.mark.parametrize(
        "role, is_viewer", [(_MEMBER, False), (_VIEWER, True)], ids=["member", "viewer"]
    )
    async def test_execute_call_tool_enforces_viewer_write_restriction(
        self,
        _app_mcp_code_mode: _AppInfo,
        _get_user: _GetUser,
        role: UserRoleInput,
        is_viewer: bool,
    ) -> None:
        """The read-only viewer restriction must also hold through ``execute``.

        A viewer mutating through ``execute`` -> ``call_tool`` must hit the same
        ``restrict_access_by_viewers`` ``403`` as the direct path; a member passes it
        and fails only on the fake id (``422``). Distinguished by ``403`` versus
        not-``403``.
        """
        app = _app_mcp_code_mode
        token = _mcp_token_for(app, _get_user, role)
        async with Client(_mcp_transport(app, token)) as mcp_client:
            result = await mcp_client.call_tool(
                "execute",
                {
                    "code": 'return await call_tool("deleteAnnotationConfig", {"config_id": "fake-id"})'
                },
                raise_on_error=False,
            )
        text = "".join(getattr(block, "text", "") for block in (result.content or []))
        assert result.is_error, text
        lowered = text.lower()
        if is_viewer:
            assert "403" in text or "forbidden" in lowered, (
                f"viewer not blocked via execute: {text}"
            )
        else:
            assert "403" not in text and "forbidden" not in lowered, (
                f"member wrongly blocked: {text}"
            )
