"""Cross-consumer lifecycle controls for HC-26 using only local fixtures."""

from __future__ import annotations

from typing import Any

import pytest
from opentelemetry.sdk.trace.export import SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from tests.integration._helpers import (
    _ADMIN,
    _MEMBER,
    _AppInfo,
    _GetUser,
    _grpc_span_exporter,
    _httpx_client,
    _start_span,
)
from tests.integration.auth.test_mcp import _register_public_client

pytestmark = [pytest.mark.session_management]


def _initialize_request() -> dict[str, object]:
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "security-live-state", "version": "0"},
        },
    }


def _agent_request() -> dict[str, Any]:
    return {
        "trigger": "submit-message",
        "id": "security-live-state-message",
        "messages": [
            {
                "id": "security-live-state-user-message",
                "role": "user",
                "parts": [{"type": "text", "text": "local authorization control"}],
            }
        ],
        "model": {
            "providerType": "builtin",
            "provider": "ANTHROPIC",
            "modelName": "claude-3-5-sonnet-20241022",
        },
        "contexts": [],
    }


def _assert_http_consumers(
    app: _AppInfo,
    credential: str,
    *,
    status_code: int,
) -> None:
    headers = {"authorization": f"Bearer {credential}"}
    assert _httpx_client(app).get("v1/projects", headers=headers).status_code == status_code
    assert (
        _httpx_client(app)
        .post("graphql", headers=headers, json={"query": "query { viewer { id } }"})
        .status_code
        == status_code
    )
    assert (
        _httpx_client(app)
        .post(
            "mcp",
            headers={"accept": "application/json, text/event-stream", **headers},
            json=_initialize_request(),
        )
        .status_code
        == status_code
    )
    assert (
        _httpx_client(app)
        .post(
            "agents/server/sessions/security-live-state/chat",
            headers=headers,
            json=_agent_request(),
        )
        .status_code
        == status_code
    )


def _grpc_result(app: _AppInfo, credential: str, project_name: str) -> SpanExportResult:
    memory = InMemorySpanExporter()
    _start_span(exporter=memory, project_name=project_name).end()
    return _grpc_span_exporter(
        app,
        headers={"authorization": f"Bearer {credential}"},
    ).export(memory.get_finished_spans())


def _assert_credential_is_live(app: _AppInfo, credential: str, project_name: str) -> None:
    _assert_http_consumers(app, credential, status_code=200)
    assert _grpc_result(app, credential, project_name) is SpanExportResult.SUCCESS


def _assert_credential_is_revoked(app: _AppInfo, credential: str, project_name: str) -> None:
    _assert_http_consumers(app, credential, status_code=401)
    assert _grpc_result(app, credential, project_name) is SpanExportResult.FAILURE


def test_oauth_grant_revocation_propagates_to_all_local_consumers(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    """A revoked OAuth access token cannot retain a consumer-specific capability."""
    affected_user = _get_user(_app, _MEMBER).log_in(_app)
    affected_token = _register_public_client(_app).complete_flow(affected_user)["access_token"]
    control_user = _get_user(_app, _MEMBER).log_in(_app)
    control_token = _register_public_client(_app).complete_flow(control_user)["access_token"]

    _assert_credential_is_live(_app, affected_token, "security-live-oauth-before")
    revoke_response = _httpx_client(_app).post("oauth2/revoke", data={"token": affected_token})
    assert revoke_response.status_code == 200
    _assert_credential_is_revoked(_app, affected_token, "security-live-oauth-after")
    _assert_credential_is_live(_app, control_token, "security-live-oauth-control")


def test_deleted_user_invalidates_api_key_at_all_local_consumers(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    """Deleting an owner revokes their API key without affecting another member."""
    affected_user = _get_user(_app, _MEMBER)
    affected_key = str(affected_user.create_api_key(_app))
    control_user = _get_user(_app, _MEMBER)
    control_key = str(control_user.create_api_key(_app))

    _assert_credential_is_live(_app, affected_key, "security-live-key-before")
    _get_user(_app, _ADMIN).delete_users(_app, affected_user)
    _assert_credential_is_revoked(_app, affected_key, "security-live-key-after")
    _assert_credential_is_live(_app, control_key, "security-live-key-control")


def test_role_downgrade_invalidates_preexisting_browser_access_token(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    """A member's pre-change browser token cannot survive a viewer downgrade."""
    affected_user = _get_user(_app, _MEMBER)
    affected_token = str(affected_user.log_in(_app).tokens.access_token)
    control_token = str(_get_user(_app, _MEMBER).log_in(_app).tokens.access_token)

    _assert_credential_is_live(_app, affected_token, "security-live-role-before")
    _get_user(_app, _ADMIN).patch_user(_app, affected_user, new_role=UserRoleInput.VIEWER)
    _assert_credential_is_revoked(_app, affected_token, "security-live-role-after")
    _assert_credential_is_live(_app, control_token, "security-live-role-control")


def test_logout_and_refresh_rotation_do_not_leave_old_browser_tokens_live(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    """Logout and refresh replace the session's usable browser credentials."""
    user = _get_user(_app, _MEMBER).log_in(_app)
    old_access_token = str(user.tokens.access_token)
    old_refresh_token = user.tokens.refresh_token
    rotated_tokens = user.tokens.refresh(_app)

    _assert_credential_is_revoked(_app, old_access_token, "security-live-refresh-old-access")
    assert _httpx_client(_app, old_refresh_token).post("auth/refresh").status_code == 401
    _assert_credential_is_live(
        _app,
        str(rotated_tokens.access_token),
        "security-live-refresh-new-access",
    )

    rotated_tokens.log_out(_app)
    _assert_credential_is_revoked(
        _app,
        str(rotated_tokens.access_token),
        "security-live-logout-access",
    )
