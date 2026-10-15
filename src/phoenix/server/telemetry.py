import logging
import os
from typing import TYPE_CHECKING

from phoenix.config import (
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_GRPC_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_HTTP_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
)

if TYPE_CHECKING:
    from opentelemetry.sdk._logs import LoggerProvider
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.trace import TracerProvider

logger = logging.getLogger(__name__)

_SERVICE_NAME = "arize-phoenix-server"
_OTLP_HTTP_TRACES_PATH = "/v1/traces"
_OTLP_HTTP_LOGS_PATH = "/v1/logs"


def normalize_http_collector_endpoint(endpoint: str) -> str:
    normalized_endpoint = endpoint
    if not normalized_endpoint.startswith("http://") and not normalized_endpoint.startswith(
        "https://"
    ):
        logger.warning(
            "HTTP collector endpoint should include the protocol (http:// or https://)."
            "Assuming http."
        )
        normalized_endpoint = f"http://{endpoint}"
    for signal_path in (_OTLP_HTTP_TRACES_PATH, _OTLP_HTTP_LOGS_PATH):
        if normalized_endpoint.endswith(signal_path):
            logger.warning(
                f"HTTP collector endpoint should not include the {signal_path} path. Removing it."
            )
            normalized_endpoint = normalized_endpoint[: -len(signal_path)]
    return normalized_endpoint.rstrip("/")


def _server_resource() -> "Resource":
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.semconv.resource import ResourceAttributes

    return Resource(attributes={ResourceAttributes.SERVICE_NAME: _SERVICE_NAME})


def initialize_opentelemetry_tracer_provider() -> "TracerProvider":
    logger.info("Initializing OpenTelemetry tracer provider")
    from opentelemetry.sdk import trace as trace_sdk
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    tracer_provider = trace_sdk.TracerProvider(resource=_server_resource())
    if http_endpoint := os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT
    ):
        logger.info(f"Using HTTP collector endpoint: {http_endpoint}")
        http_endpoint = normalize_http_collector_endpoint(http_endpoint) + _OTLP_HTTP_TRACES_PATH
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter as HttpExporter,
        )

        tracer_provider.add_span_processor(BatchSpanProcessor(HttpExporter(http_endpoint)))
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


def initialize_opentelemetry_logger_provider() -> "LoggerProvider":
    """Build a logger provider exporting over OTLP and attach it to the root logger.

    The provider is returned so the caller can shut it down, which flushes pending records.
    """
    logger.info("Initializing OpenTelemetry logger provider")
    from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
    from opentelemetry.sdk._logs.export import BatchLogRecordProcessor

    logger_provider = LoggerProvider(resource=_server_resource())
    if http_endpoint := os.getenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_HTTP_ENDPOINT
    ):
        logger.info(f"Using HTTP log collector endpoint: {http_endpoint}")
        http_endpoint = normalize_http_collector_endpoint(http_endpoint) + _OTLP_HTTP_LOGS_PATH
        from opentelemetry.exporter.otlp.proto.http._log_exporter import (
            OTLPLogExporter as HttpExporter,
        )

        logger_provider.add_log_record_processor(
            BatchLogRecordProcessor(HttpExporter(http_endpoint))
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
