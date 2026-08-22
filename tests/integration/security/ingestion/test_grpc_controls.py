"""Passing authentication and role controls at the OTLP gRPC ingestion boundary."""

from __future__ import annotations

from secrets import token_hex
from time import monotonic, sleep

import pytest
from opentelemetry.sdk.trace.export import SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from tests.integration._helpers import (
    _MEMBER,
    _VIEWER,
    _AppInfo,
    _GetUser,
    _grpc_span_exporter,
    _httpx_client,
    _start_span,
)
from tests.integration.auth.test_mcp import _register_public_client

pytestmark = [pytest.mark.authn, pytest.mark.authz]


def _project_names(app: _AppInfo, project_name: str) -> set[str]:
    response = _httpx_client(app, app.admin_secret).get(
        "v1/projects",
        params={"name_contains": project_name},
    )
    response.raise_for_status()
    return {project["name"] for project in response.json()["data"]}


def _wait_for_project(app: _AppInfo, project_name: str, timeout: float = 10) -> None:
    deadline = monotonic() + timeout
    while monotonic() < deadline:
        if project_name in _project_names(app, project_name):
            return
        sleep(0.05)
    raise AssertionError(f"project {project_name!r} was not persisted within {timeout} seconds")


def _flush_ingestion_queue(app: _AppInfo) -> None:
    project_name = f"security-grpc-barrier-{token_hex(8)}"
    memory = InMemorySpanExporter()
    _start_span(exporter=memory, project_name=project_name).end()
    result = _grpc_span_exporter(
        app,
        headers={"authorization": f"Bearer {app.admin_secret}"},
    ).export(memory.get_finished_spans())
    assert result is SpanExportResult.SUCCESS
    _wait_for_project(app, project_name)


@pytest.mark.parametrize("credential_kind", ["missing", "invalid"], ids=["missing", "invalid"])
def test_grpc_ingestion_rejects_missing_or_invalid_bearer_metadata(
    _app: _AppInfo,
    credential_kind: str,
) -> None:
    """No credentials and inert credentials fail before a synthetic span is accepted."""
    headers = None if credential_kind == "missing" else {"authorization": "Bearer security-invalid"}
    project_name = f"security-grpc-{credential_kind}-{token_hex(8)}"
    memory = InMemorySpanExporter()
    _start_span(exporter=memory, project_name=project_name).end()

    result = _grpc_span_exporter(_app, headers=headers).export(memory.get_finished_spans())

    assert result is SpanExportResult.FAILURE
    _flush_ingestion_queue(_app)
    assert project_name not in _project_names(_app, project_name)


def test_grpc_ingestion_rejects_viewer_access_token(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    """A valid viewer token authenticates but cannot write OTLP telemetry."""
    viewer = _get_user(_app, _VIEWER).log_in(_app)
    access_token = _register_public_client(_app).complete_flow(viewer)["access_token"]
    project_name = f"security-grpc-viewer-{token_hex(8)}"
    memory = InMemorySpanExporter()
    _start_span(exporter=memory, project_name=project_name).end()

    result = _grpc_span_exporter(
        _app,
        headers={"authorization": f"Bearer {access_token}"},
    ).export(memory.get_finished_spans())
    del access_token

    assert result is SpanExportResult.FAILURE
    _flush_ingestion_queue(_app)
    assert project_name not in _project_names(_app, project_name)


def test_grpc_ingestion_accepts_member_access_token(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    """A member access token is the positive control for the same one-span fixture."""
    member = _get_user(_app, _MEMBER).log_in(_app)
    access_token = _register_public_client(_app).complete_flow(member)["access_token"]
    project_name = f"security-grpc-member-{token_hex(8)}"
    memory = InMemorySpanExporter()
    _start_span(exporter=memory, project_name=project_name).end()

    result = _grpc_span_exporter(
        _app,
        headers={"authorization": f"Bearer {access_token}"},
    ).export(memory.get_finished_spans())
    del access_token

    assert result is SpanExportResult.SUCCESS
    _wait_for_project(_app, project_name)
