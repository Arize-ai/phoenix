"""Passing OAuth credential-type and resource-audience security controls."""

from __future__ import annotations

import pytest
from opentelemetry.sdk.trace.export import SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from tests.integration._helpers import (
    _MEMBER,
    _AppInfo,
    _GetUser,
    _grpc_span_exporter,
    _httpx_client,
    _start_span,
)
from tests.integration.auth.test_mcp import _register_public_client

pytestmark = [pytest.mark.authn, pytest.mark.authz]


def test_refresh_token_cannot_authenticate_as_resource_bearer(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    """A refresh token is not an access token at either HTTP or OTLP gRPC."""
    oauth_client = _register_public_client(
        _app,
        resource=f"{_app.base_url.rstrip('/')}/mcp",
    )
    user = _get_user(_app, _MEMBER).log_in(_app)
    refresh_token = oauth_client.complete_flow(user)["refresh_token"]

    response = _httpx_client(_app).get(
        "v1/projects",
        headers={"authorization": f"Bearer {refresh_token}"},
    )
    assert response.status_code == 401

    memory = InMemorySpanExporter()
    _start_span(exporter=memory, project_name="security-green-refresh-token").end()
    spans = memory.get_finished_spans()
    assert len(spans) == 1
    result = _grpc_span_exporter(
        _app,
        headers={"authorization": f"Bearer {refresh_token}"},
    ).export(spans)
    del refresh_token
    assert result is SpanExportResult.FAILURE


def test_mcp_audience_token_is_rejected_by_origin_http_resources(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    """An MCP-scoped access token cannot be replayed at REST or GraphQL."""
    oauth_client = _register_public_client(
        _app,
        resource=f"{_app.base_url.rstrip('/')}/mcp",
    )
    user = _get_user(_app, _MEMBER).log_in(_app)
    access_token = oauth_client.complete_flow(user)["access_token"]
    headers = {"authorization": f"Bearer {access_token}"}

    rest_response = _httpx_client(_app).get("v1/projects", headers=headers)
    graphql_response = _httpx_client(_app).post(
        "graphql",
        headers=headers,
        json={"query": "query SecurityGreen { viewer { id } }"},
    )
    del access_token

    assert rest_response.status_code == 401
    assert graphql_response.status_code == 401
