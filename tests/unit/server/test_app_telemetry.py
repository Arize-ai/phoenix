import contextlib

import httpx
import pytest
from asgi_lifespan import LifespanManager
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import InMemoryLogRecordExporter, SimpleLogRecordProcessor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from phoenix.server import app as server_app
from phoenix.server.app import create_app
from phoenix.server.types import DbSessionFactory
from tests.unit.conftest import TestBulkInserter, patch_dml_event_handler, patch_grpc_server


async def _get(db: DbSessionFactory, path: str) -> httpx.Response:
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_dml_event_handler())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
        )
        manager = await stack.enter_async_context(LifespanManager(app))
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=manager.app), base_url="http://test"
        ) as client:
            return await client.get(path)


async def test_server_instrumentation_traces_http_requests_with_native_fastapi_telemetry(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    exporter = InMemorySpanExporter()
    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    monkeypatch.setattr(server_app, "server_instrumentation_is_enabled", lambda: True)
    monkeypatch.setattr(
        server_app, "initialize_opentelemetry_tracer_provider", lambda: tracer_provider
    )
    response = await _get(db, "/healthz")
    assert response.status_code == 200
    request_spans = [
        span
        for span in exporter.get_finished_spans()
        if (span.attributes or {}).get("http.route") == "/healthz"
    ]
    assert len(request_spans) == 1
    assert request_spans[0].name == "GET /healthz"


async def test_server_log_export_records_validation_failures_with_native_fastapi_telemetry(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    exporter = InMemoryLogRecordExporter()  # type: ignore[no-untyped-call]
    logger_provider = LoggerProvider()
    logger_provider.add_log_record_processor(SimpleLogRecordProcessor(exporter))
    monkeypatch.setattr(server_app, "server_log_export_is_enabled", lambda: True)
    monkeypatch.setattr(
        server_app, "initialize_opentelemetry_logger_provider", lambda: logger_provider
    )
    response = await _get(db, "/v1/projects?limit=not-an-int")
    assert response.status_code == 422
    validation_logs = [
        log
        for log in exporter.get_finished_logs()
        if log.log_record.event_name == "fastapi.validation.failed"
    ]
    assert len(validation_logs) == 1
    assert (validation_logs[0].log_record.attributes or {}).get("http.route") == "/v1/projects"
