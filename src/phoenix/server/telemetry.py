import logging
import os
import re
import weakref
from collections.abc import Callable
from typing import Any, Final, Optional

from opentelemetry import context as otel_context
from opentelemetry import trace
from opentelemetry.context import _SUPPRESS_INSTRUMENTATION_KEY
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider as SdkTracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.semconv.attributes.service_attributes import SERVICE_NAME, SERVICE_VERSION
from opentelemetry.trace import Span, SpanKind, Status, StatusCode, TracerProvider
from sqlalchemy import event
from sqlalchemy.engine import Connection as SAConnection
from sqlalchemy.engine.interfaces import ExceptionContext, ExecutionContext
from sqlalchemy.ext.asyncio import AsyncEngine

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

_DB_SYSTEM: Final[str] = "db.system"
_DB_NAME: Final[str] = "db.name"
_DB_OPERATION: Final[str] = "db.operation"
_DB_STATEMENT: Final[str] = "db.statement"
_NET_PEER_NAME: Final[str] = "net.peer.name"
_NET_PEER_PORT: Final[str] = "net.peer.port"

_LEADING_SQL_COMMENT_RE = re.compile(r"^(?:\s+|--[^\n]*(?:\n|$)|/\*[\s\S]*?\*/)*")


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
            SERVICE_NAME: _SERVICE_NAME,
            SERVICE_VERSION: __version__,
        }
    )


def initialize_opentelemetry_tracer_provider() -> SdkTracerProvider:
    logger.info("Initializing OpenTelemetry tracer provider")
    tracer_provider = SdkTracerProvider(resource=_server_resource())
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


def _extract_sql_operation(statement: str) -> Optional[str]:
    stripped = _LEADING_SQL_COMMENT_RE.sub("", statement, count=1)
    parts = stripped.split(None, 1)
    if not parts:
        return None
    return parts[0].rstrip(";") or None


def _format_sql_span_name(
    *,
    operation: Optional[str],
    db_name: Optional[str],
    db_system: str,
) -> str:
    if operation and db_name:
        return f"{operation} {db_name}"
    if operation:
        return operation
    if db_name:
        return db_name
    return db_system


def instrument_sqlalchemy_engine(
    engine: AsyncEngine,
    *,
    tracer_provider: TracerProvider,
) -> Callable[[], None]:
    """Attach OpenTelemetry ``CLIENT`` span listeners to one SQLAlchemy ``AsyncEngine``.

    Requires a valid active parent and unsuppressed instrumentation.

    Args:
        engine: The SQLAlchemy async engine whose cursor executions should be traced.
        tracer_provider: The server's OpenTelemetry ``TracerProvider``.

    Returns:
        An idempotent cleanup callable that removes the listeners from ``engine``.
    """
    sync_engine = engine.sync_engine
    tracer = tracer_provider.get_tracer("phoenix.server.db", __version__)
    db_system = sync_engine.dialect.name
    db_name = sync_engine.url.database or None
    base_attributes: dict[str, str | int] = {_DB_SYSTEM: db_system}
    if db_name:
        base_attributes[_DB_NAME] = db_name
    if sync_engine.url.host:
        base_attributes[_NET_PEER_NAME] = sync_engine.url.host
    if sync_engine.url.port is not None:
        base_attributes[_NET_PEER_PORT] = sync_engine.url.port

    # Connection.info can trigger reconnection during error handling.
    in_flight_spans: weakref.WeakKeyDictionary[SAConnection, list[Span]] = (
        weakref.WeakKeyDictionary()
    )

    def _before_cursor_execute(
        connection: SAConnection,
        cursor: Any,
        statement: str,
        parameters: Any,
        execution_context: Optional[ExecutionContext],
        executemany: bool,
    ) -> None:
        if bool(otel_context.get_value(_SUPPRESS_INSTRUMENTATION_KEY)):
            return
        if not trace.get_current_span().get_span_context().is_valid:
            return
        operation = _extract_sql_operation(statement)
        span_name = _format_sql_span_name(
            operation=operation,
            db_name=db_name,
            db_system=db_system,
        )
        span = tracer.start_span(span_name, kind=SpanKind.CLIENT)
        if span.is_recording():
            span.set_attributes(base_attributes)
            if operation is not None:
                span.set_attribute(_DB_OPERATION, operation)
            span.set_attribute(_DB_STATEMENT, statement)
        in_flight_spans.setdefault(connection, []).append(span)

    def _after_cursor_execute(
        connection: SAConnection,
        cursor: Any,
        statement: str,
        parameters: Any,
        execution_context: Optional[ExecutionContext],
        executemany: bool,
    ) -> None:
        spans = in_flight_spans.get(connection)
        if not spans:
            return
        span = spans.pop()
        if not spans:
            in_flight_spans.pop(connection, None)
        span.end()

    def _handle_error(exception_context: ExceptionContext) -> None:
        connection = exception_context.connection
        if connection is None:
            return
        spans = in_flight_spans.get(connection)
        if not spans:
            return
        span = spans.pop()
        if not spans:
            in_flight_spans.pop(connection, None)
        if span.is_recording():
            exception = exception_context.original_exception
            span.record_exception(exception)
            span.set_status(Status(StatusCode.ERROR, str(exception)))
        span.end()

    listeners: tuple[tuple[str, Callable[..., Any]], ...] = (
        ("before_cursor_execute", _before_cursor_execute),
        ("after_cursor_execute", _after_cursor_execute),
        ("handle_error", _handle_error),
    )
    for identifier, fn in listeners:
        event.listen(sync_engine, identifier, fn)

    def _uninstrument() -> None:
        for identifier, fn in listeners:
            if event.contains(sync_engine, identifier, fn):
                event.remove(sync_engine, identifier, fn)

    return _uninstrument
