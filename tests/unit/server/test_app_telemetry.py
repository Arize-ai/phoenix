import contextlib

import httpx
import pytest
from asgi_lifespan import LifespanManager
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from phoenix.server import app as server_app
from phoenix.server.app import create_app
from phoenix.server.types import DbSessionFactory
from tests.unit.conftest import TestBulkInserter, patch_dml_event_handler, patch_grpc_server


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
            response = await client.get("/healthz")
    assert response.status_code == 200
    request_spans = [
        span
        for span in exporter.get_finished_spans()
        if (span.attributes or {}).get("http.route") == "/healthz"
    ]
    assert len(request_spans) == 1
    assert request_spans[0].name == "GET /healthz"
