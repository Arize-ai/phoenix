from pathlib import Path
from typing import Iterator

import pytest
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import SpanKind
from sqlalchemy import make_url, text

from phoenix.config import ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT
from phoenix.db.engines import aio_sqlite_engine, aio_sqlite_read_engine
from phoenix.server import app as app_module
from phoenix.server.app import instrument_engine_if_enabled


@pytest.fixture
def span_exporter(monkeypatch: pytest.MonkeyPatch) -> Iterator[InMemorySpanExporter]:
    """Enables server instrumentation and routes its spans to memory instead of OTLP."""
    monkeypatch.setenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
        "http://127.0.0.1:1",
    )
    exporter = InMemorySpanExporter()

    def tracer_provider() -> TracerProvider:
        provider = TracerProvider()
        provider.add_span_processor(SimpleSpanProcessor(exporter))
        return provider

    monkeypatch.setattr(app_module, "initialize_opentelemetry_tracer_provider", tracer_provider)
    yield exporter
    if SQLAlchemyInstrumentor().is_instrumented_by_opentelemetry:
        SQLAlchemyInstrumentor().uninstrument()


def _statements(exporter: InMemorySpanExporter) -> list[str]:
    return [
        str(span.attributes["db.statement"])
        for span in exporter.get_finished_spans()
        if span.kind is SpanKind.CLIENT
        and span.attributes is not None
        and "db.statement" in span.attributes
    ]


async def test_instrumented_engine_emits_db_client_spans(
    span_exporter: InMemorySpanExporter,
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
    assert "SELECT 41" in _statements(span_exporter)


async def test_primary_and_read_engines_both_emit_db_client_spans(
    span_exporter: InMemorySpanExporter,
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
    statements = _statements(span_exporter)
    assert "SELECT 41" in statements
    assert "SELECT 42" in statements
