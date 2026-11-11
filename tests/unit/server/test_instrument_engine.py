from pathlib import Path

import pytest
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import SpanKind
from sqlalchemy import make_url, text

from phoenix.db.engines import aio_sqlite_engine, aio_sqlite_read_engine
from phoenix.server.app import instrument_engine


@pytest.fixture
def span_exporter() -> InMemorySpanExporter:
    return InMemorySpanExporter()


@pytest.fixture
def tracer_provider(span_exporter: InMemorySpanExporter) -> TracerProvider:
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(span_exporter))
    return provider


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
    tracer_provider: TracerProvider,
    tmp_path: Path,
) -> None:
    url = make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}")
    engine = aio_sqlite_engine(url=url, migrate=False)
    cleanups = instrument_engine(engine, tracer_provider)
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
    tracer_provider: TracerProvider,
    tmp_path: Path,
) -> None:
    # Mirrors serve.py: the primary engine and the SQLite read engine are each
    # instrumented, one after the other.
    url = make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}")
    primary_engine = aio_sqlite_engine(url=url, migrate=False)
    async with primary_engine.connect() as conn:  # creates the file for the read engine
        await conn.execute(text("SELECT 0"))
    read_engine = aio_sqlite_read_engine(url)
    assert read_engine is not None
    cleanups = instrument_engine(primary_engine, tracer_provider)
    cleanups.extend(instrument_engine(read_engine, tracer_provider))
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
