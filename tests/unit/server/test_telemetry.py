import logging
import logging.config
from collections.abc import Iterator

import pytest
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import InMemoryLogRecordExporter, SimpleLogRecordProcessor
from opentelemetry.semconv.resource import ResourceAttributes
from uvicorn.config import LOGGING_CONFIG

from phoenix.server.telemetry import (
    _server_resource,
    export_uvicorn_logs,
    normalize_http_log_collector_endpoint,
    normalize_http_trace_collector_endpoint,
)
from phoenix.version import __version__


def test_normalize_http_trace_collector_endpoint() -> None:
    expected = "http://localhost:4318/v1/traces"
    assert normalize_http_trace_collector_endpoint("http://localhost:4318") == expected
    assert normalize_http_trace_collector_endpoint("http://localhost:4318/") == expected
    assert normalize_http_trace_collector_endpoint("localhost:4318") == expected
    assert normalize_http_trace_collector_endpoint("http://localhost:4318/v1/traces") == expected
    assert normalize_http_trace_collector_endpoint("localhost:4318/v1/traces") == expected
    assert (
        normalize_http_trace_collector_endpoint("https://localhost:4318/v1/traces")
        == "https://localhost:4318/v1/traces"
    )


def test_normalize_http_log_collector_endpoint() -> None:
    expected = "http://localhost:4318/v1/logs"
    assert normalize_http_log_collector_endpoint("http://localhost:4318") == expected
    assert normalize_http_log_collector_endpoint("localhost:4318") == expected
    assert normalize_http_log_collector_endpoint("http://localhost:4318/v1/logs") == expected


def test_server_resource_carries_service_name_and_version() -> None:
    attributes = _server_resource().attributes
    assert attributes[ResourceAttributes.SERVICE_NAME] == "arize-phoenix-server"
    assert attributes[ResourceAttributes.SERVICE_VERSION] == __version__


@pytest.fixture
def otel_root_handler() -> Iterator[InMemoryLogRecordExporter]:
    """A root-logger OpenTelemetry handler whose records land in memory, removed afterwards."""
    exporter = InMemoryLogRecordExporter()  # type: ignore[no-untyped-call]
    provider = LoggerProvider()
    provider.add_log_record_processor(SimpleLogRecordProcessor(exporter))
    handler = LoggingHandler(logger_provider=provider)
    root_logger, uvicorn_logger = logging.getLogger(), logging.getLogger("uvicorn")
    saved = (list(uvicorn_logger.handlers), uvicorn_logger.propagate, uvicorn_logger.level)
    root_logger.addHandler(handler)
    try:
        yield exporter
    finally:
        root_logger.removeHandler(handler)
        uvicorn_logger.handlers, uvicorn_logger.propagate, uvicorn_logger.level = saved
        provider.shutdown()


def test_export_uvicorn_logs_reaches_the_exporter_under_uvicorn_logging_config(
    otel_root_handler: InMemoryLogRecordExporter,
) -> None:
    logging.config.dictConfig(LOGGING_CONFIG)  # what uvicorn.Config applies in the default mode
    logging.getLogger("uvicorn.error").error("Exception in ASGI application")
    assert not otel_root_handler.get_finished_logs(), "uvicorn's config cuts records off from root"

    export_uvicorn_logs()
    logging.getLogger("uvicorn.error").error("Exception in ASGI application")
    (record,) = otel_root_handler.get_finished_logs()
    assert record.log_record.body == "Exception in ASGI application"


def test_export_uvicorn_logs_adds_nothing_when_records_already_propagate(
    otel_root_handler: InMemoryLogRecordExporter,
) -> None:
    uvicorn_logger = logging.getLogger("uvicorn")
    uvicorn_logger.handlers, uvicorn_logger.propagate = [], True  # the structured logging mode
    export_uvicorn_logs()
    assert uvicorn_logger.handlers == []
    logging.getLogger("uvicorn.error").error("Exception in ASGI application")
    assert len(otel_root_handler.get_finished_logs()) == 1
