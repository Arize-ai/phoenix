import logging
from collections.abc import Iterator

import pytest
from opentelemetry.exporter.otlp.proto.grpc import _log_exporter as grpc_log_exporter
from opentelemetry.exporter.otlp.proto.http import _log_exporter as http_log_exporter
from opentelemetry.sdk._logs import LoggingHandler
from opentelemetry.sdk._logs.export import InMemoryLogExporter

from phoenix.config import (
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_GRPC_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_HTTP_ENDPOINT,
)
from phoenix.server.telemetry import (
    initialize_opentelemetry_logger_provider,
    normalize_http_collector_endpoint,
)


def test_normalize_http_collector_endpoint() -> None:
    assert normalize_http_collector_endpoint("http://localhost:4317") == "http://localhost:4317"
    assert normalize_http_collector_endpoint("https://localhost:4317") == "https://localhost:4317"
    assert normalize_http_collector_endpoint("localhost:4317") == "http://localhost:4317"
    assert (
        normalize_http_collector_endpoint("http://localhost:4317/v1/traces")
        == "http://localhost:4317"
    )
    assert (
        normalize_http_collector_endpoint("https://localhost:4317/v1/traces")
        == "https://localhost:4317"
    )
    assert normalize_http_collector_endpoint("localhost:4317/v1/traces") == "http://localhost:4317"
    assert (
        normalize_http_collector_endpoint("http://localhost:4318/v1/logs")
        == "http://localhost:4318"
    )
    assert normalize_http_collector_endpoint("localhost:4318/v1/logs") == "http://localhost:4318"


def _recording_exporter(endpoints: list[str]) -> type[InMemoryLogExporter]:
    """Stand in for an OTLP log exporter, recording the endpoint each instance is built with."""

    class RecordingExporter(InMemoryLogExporter):
        def __init__(self, endpoint: str = "") -> None:
            super().__init__()  # type: ignore[no-untyped-call]
            endpoints.append(endpoint)

    return RecordingExporter


@pytest.fixture
def http_exporter_endpoints(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    endpoints: list[str] = []
    monkeypatch.setattr(http_log_exporter, "OTLPLogExporter", _recording_exporter(endpoints))
    return endpoints


@pytest.fixture
def grpc_exporter_endpoints(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    endpoints: list[str] = []
    monkeypatch.setattr(grpc_log_exporter, "OTLPLogExporter", _recording_exporter(endpoints))
    return endpoints


@pytest.fixture
def log_collector_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.delenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_HTTP_ENDPOINT, raising=False
    )
    monkeypatch.delenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_GRPC_ENDPOINT, raising=False
    )
    root_logger = logging.getLogger()
    handlers_before = list(root_logger.handlers)
    yield
    for handler in list(root_logger.handlers):
        if handler not in handlers_before:
            root_logger.removeHandler(handler)


def _attached_logging_handlers() -> list[LoggingHandler]:
    return [h for h in logging.getLogger().handlers if isinstance(h, LoggingHandler)]


@pytest.mark.usefixtures("log_collector_env")
def test_logger_provider_with_http_endpoint(
    monkeypatch: pytest.MonkeyPatch, http_exporter_endpoints: list[str]
) -> None:
    monkeypatch.setenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_HTTP_ENDPOINT, "localhost:4318"
    )
    logger_provider = initialize_opentelemetry_logger_provider()
    assert http_exporter_endpoints == ["http://localhost:4318/v1/logs"]
    assert logger_provider.resource.attributes["service.name"] == "arize-phoenix-server"
    (handler,) = _attached_logging_handlers()
    assert handler._logger_provider is logger_provider
    logger_provider.shutdown()


@pytest.mark.usefixtures("log_collector_env")
def test_logger_provider_with_grpc_endpoint(
    monkeypatch: pytest.MonkeyPatch, grpc_exporter_endpoints: list[str]
) -> None:
    monkeypatch.setenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_GRPC_ENDPOINT, "localhost:4317"
    )
    logger_provider = initialize_opentelemetry_logger_provider()
    assert grpc_exporter_endpoints == ["localhost:4317"]
    assert len(_attached_logging_handlers()) == 1
    logger_provider.shutdown()


@pytest.mark.usefixtures("log_collector_env")
def test_logger_provider_without_endpoints(
    http_exporter_endpoints: list[str], grpc_exporter_endpoints: list[str]
) -> None:
    logger_provider = initialize_opentelemetry_logger_provider()
    assert http_exporter_endpoints == []
    assert grpc_exporter_endpoints == []
    assert len(_attached_logging_handlers()) == 1
    logger_provider.shutdown()
