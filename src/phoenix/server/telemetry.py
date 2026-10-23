import logging
import os

from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.semconv.resource import ResourceAttributes

from phoenix.config import (
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_GRPC_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_HTTP_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
)
from phoenix.version import __version__

logger = logging.getLogger(__name__)

_SERVICE_NAME = "arize-phoenix-server"
_OTLP_HTTP_TRACES_PATH = "/v1/traces"
_OTLP_HTTP_LOGS_PATH = "/v1/logs"


def normalize_http_trace_collector_endpoint(endpoint: str) -> str:
    return _normalize_http_collector_endpoint(endpoint, _OTLP_HTTP_TRACES_PATH)


def normalize_http_log_collector_endpoint(endpoint: str) -> str:
    return _normalize_http_collector_endpoint(endpoint, _OTLP_HTTP_LOGS_PATH)


def _normalize_http_collector_endpoint(endpoint: str, signal_path: str) -> str:
    """Return the full OTLP/HTTP URL for one signal, tolerating a missing scheme or a
    pre-appended signal path."""
    normalized_endpoint = endpoint
    if not normalized_endpoint.startswith("http://") and not normalized_endpoint.startswith(
        "https://"
    ):
        logger.warning(
            "HTTP collector endpoint should include the protocol (http:// or https://)."
            "Assuming http."
        )
        normalized_endpoint = f"http://{endpoint}"
    if normalized_endpoint.endswith(signal_path):
        logger.warning(
            f"HTTP collector endpoint should not include the {signal_path} path. Removing it."
        )
        normalized_endpoint = normalized_endpoint[: -len(signal_path)]
    return normalized_endpoint.rstrip("/") + signal_path


def _server_resource() -> Resource:
    return Resource(
        attributes={
            ResourceAttributes.SERVICE_NAME: _SERVICE_NAME,
            ResourceAttributes.SERVICE_VERSION: __version__,
        }
    )


def initialize_opentelemetry_tracer_provider() -> TracerProvider:
    logger.info("Initializing OpenTelemetry tracer provider")
    tracer_provider = TracerProvider(resource=_server_resource())
    if http_endpoint := os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT
    ):
        logger.info(f"Using HTTP collector endpoint: {http_endpoint}")
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter as HttpExporter,
        )

        tracer_provider.add_span_processor(
            BatchSpanProcessor(HttpExporter(normalize_http_trace_collector_endpoint(http_endpoint)))
        )
    if grpc_endpoint := os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT
    ):
        logger.info(f"Using gRPC collector endpoint: {grpc_endpoint}")
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
            OTLPSpanExporter as GrpcExporter,
        )

        tracer_provider.add_span_processor(BatchSpanProcessor(GrpcExporter(grpc_endpoint)))
    logger.info("🔭 OpenTelemetry tracer provider initialized")
    return tracer_provider


def initialize_opentelemetry_logger_provider() -> LoggerProvider:
    """Build a logger provider exporting over OTLP and attach it to the root logger."""
    logger.info("Initializing OpenTelemetry logger provider")
    logger_provider = LoggerProvider(resource=_server_resource())
    if http_endpoint := os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_HTTP_ENDPOINT
    ):
        logger.info(f"Using HTTP log collector endpoint: {http_endpoint}")
        from opentelemetry.exporter.otlp.proto.http._log_exporter import (
            OTLPLogExporter as HttpExporter,
        )

        logger_provider.add_log_record_processor(
            BatchLogRecordProcessor(
                HttpExporter(normalize_http_log_collector_endpoint(http_endpoint))
            )
        )
    if grpc_endpoint := os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_GRPC_ENDPOINT
    ):
        logger.info(f"Using gRPC log collector endpoint: {grpc_endpoint}")
        from opentelemetry.exporter.otlp.proto.grpc._log_exporter import (
            OTLPLogExporter as GrpcExporter,
        )

        logger_provider.add_log_record_processor(
            BatchLogRecordProcessor(GrpcExporter(grpc_endpoint))
        )
    logging.getLogger().addHandler(LoggingHandler(logger_provider=logger_provider))
    logger.info("🔭 OpenTelemetry logger provider initialized")
    return logger_provider


def export_uvicorn_logs() -> None:
    """Attach the root logger's OpenTelemetry handlers to the `uvicorn` logger.

    uvicorn's default logging config stops its records from propagating to the root
    logger, so without this the "Exception in ASGI application" line for an uncaught
    request exception is printed but never exported. Call this after uvicorn's logging
    config has been applied, since applying it clears the `uvicorn` logger's handlers.
    Does nothing when the records already propagate, so none is exported twice.
    """
    uvicorn_logger = logging.getLogger("uvicorn")
    if uvicorn_logger.propagate:
        return
    for handler in logging.getLogger().handlers:
        if isinstance(handler, LoggingHandler) and handler not in uvicorn_logger.handlers:
            uvicorn_logger.addHandler(handler)
