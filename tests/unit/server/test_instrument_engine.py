import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
    ExportTraceServiceResponse,
)
from opentelemetry.proto.trace.v1.trace_pb2 import Span
from sqlalchemy import make_url, text

from phoenix.config import (
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
)
from phoenix.db.engines import aio_sqlite_engine, aio_sqlite_read_engine
from phoenix.server.app import instrument_engine_if_enabled


class _Collector(ThreadingHTTPServer):
    """An OTLP/HTTP trace collector that keeps the db.statement of each CLIENT span."""

    def __init__(self) -> None:
        super().__init__(("127.0.0.1", 0), _CollectorHandler)
        self.statements: list[str] = []
        self.lock = threading.Lock()


class _CollectorHandler(BaseHTTPRequestHandler):
    server: _Collector

    def do_POST(self) -> None:
        request = ExportTraceServiceRequest()
        request.ParseFromString(self.rfile.read(int(self.headers["Content-Length"])))
        with self.server.lock:
            for resource_spans in request.resource_spans:
                for scope_spans in resource_spans.scope_spans:
                    for span in scope_spans.spans:
                        if span.kind != Span.SpanKind.SPAN_KIND_CLIENT:
                            continue
                        for attribute in span.attributes:
                            if attribute.key == "db.statement":
                                self.server.statements.append(attribute.value.string_value)
        body = ExportTraceServiceResponse().SerializeToString()
        self.send_response(200)
        self.send_header("Content-Type", "application/x-protobuf")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args: object) -> None:
        pass


@pytest.fixture
def collector(monkeypatch: pytest.MonkeyPatch) -> Iterator[_Collector]:
    """Enables server instrumentation, exporting to a collector run by the test."""
    server = _Collector()
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address[:2]
    monkeypatch.setenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
        f"http://{host!s}:{port}",
    )
    monkeypatch.delenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT, raising=False
    )
    yield server
    server.shutdown()
    server.server_close()
    thread.join()


async def test_instrumented_engine_emits_db_client_spans(
    collector: _Collector,
    tmp_path: Path,
) -> None:
    url = make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}")
    engine = aio_sqlite_engine(url=url, migrate=False)
    cleanups = instrument_engine_if_enabled(engine)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 41"))
    finally:
        for cleanup in cleanups:
            cleanup()
        await engine.dispose()
    assert "SELECT 41" in collector.statements


async def test_primary_and_read_engines_both_emit_db_client_spans(
    collector: _Collector,
    tmp_path: Path,
) -> None:
    # Mirrors serve.py: the primary engine and the SQLite read engine are each
    # passed to instrument_engine_if_enabled.
    url = make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}")
    primary_engine = aio_sqlite_engine(url=url, migrate=False)
    async with primary_engine.connect() as conn:  # creates the file for the read engine
        await conn.execute(text("SELECT 0"))
    read_engine = aio_sqlite_read_engine(url)
    assert read_engine is not None
    cleanups = instrument_engine_if_enabled(primary_engine)
    cleanups.extend(instrument_engine_if_enabled(read_engine))
    try:
        async with primary_engine.connect() as conn:
            await conn.execute(text("SELECT 41"))
        async with read_engine.connect() as conn:
            await conn.execute(text("SELECT 42"))
    finally:
        for cleanup in cleanups:
            cleanup()
        await primary_engine.dispose()
        await read_engine.dispose()
    assert "SELECT 41" in collector.statements
    assert "SELECT 42" in collector.statements
