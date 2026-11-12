import logging
import os
import re
import weakref
from collections.abc import Callable, Generator
from contextlib import ExitStack, contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, Final, Optional

from opentelemetry import context as otel_context
from opentelemetry import trace
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
    server_instrumentation_is_enabled,
    server_log_export_is_enabled,
)
from phoenix.version import __version__

logger = logging.getLogger(__name__)

_SERVICE_NAME = "arize-phoenix-server"
_OTLP_HTTP_TRACES_PATH = "/v1/traces"
_OTLP_HTTP_LOGS_PATH = "/v1/logs"

# Existing server-trace consumers expect the legacy database attribute names.
_DB_SYSTEM: Final[str] = "db.system"
_DB_NAME: Final[str] = "db.name"
_DB_OPERATION: Final[str] = "db.operation"
_DB_STATEMENT: Final[str] = "db.statement"
_NET_PEER_NAME: Final[str] = "net.peer.name"
_NET_PEER_PORT: Final[str] = "net.peer.port"

_SUPPRESS_INSTRUMENTATION_KEY: Final[Optional[str]] = getattr(
    otel_context, "_SUPPRESS_INSTRUMENTATION_KEY", None
)
_LEADING_SQL_COMMENT_RE = re.compile(r"^(?:\s+|--[^\n]*(?:\n|$)|/\*[\s\S]*?\*/)*")
_LEADING_SQL_KEYWORD_RE = re.compile(r"^[A-Za-z_]+")

# Independent of OpenTelemetry's context so OpenInference detachment preserves it.
_CURRENT_SERVER_SPAN: ContextVar[Optional[tuple[TracerProvider, Span]]] = ContextVar(
    "phoenix_current_server_span", default=None
)


def is_otel_instrumentation_suppressed() -> bool:
    """Return whether OpenTelemetry instrumentation is suppressed."""
    return bool(
        _SUPPRESS_INSTRUMENTATION_KEY is not None
        and otel_context.get_value(_SUPPRESS_INSTRUMENTATION_KEY)
    )


@contextmanager
def bind_server_span(
    span: Span, tracer_provider: Optional[TracerProvider]
) -> Generator[None, None, None]:
    """Bind a server span and its provider without changing the OpenInference context."""
    binding = (
        (tracer_provider, span)
        if tracer_provider is not None and span.get_span_context().is_valid
        else None
    )
    token = _CURRENT_SERVER_SPAN.set(binding)
    try:
        yield
    finally:
        _CURRENT_SERVER_SPAN.reset(token)


def resolve_server_parent_context(
    tracer_provider: TracerProvider,
) -> Optional[otel_context.Context]:
    """Return the innermost explicitly bound span for this provider."""
    binding = _CURRENT_SERVER_SPAN.get()
    if binding is None or binding[0] is not tracer_provider:
        return None
    return trace.set_span_in_context(binding[1], otel_context.Context())


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
    with ExitStack() as stack:
        tracer_provider = SdkTracerProvider(resource=_server_resource())
        stack.callback(tracer_provider.shutdown)
        if http_endpoint := os.getenv(
            ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT
        ):
            logger.info(f"Using HTTP collector endpoint: {http_endpoint}")
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
                OTLPSpanExporter as HttpExporter,
            )

            tracer_provider.add_span_processor(
                BatchSpanProcessor(
                    HttpExporter(normalize_http_trace_collector_endpoint(http_endpoint))
                )
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
        stack.pop_all()
        return tracer_provider


def _initialize_opentelemetry_logger_provider_with_handler() -> tuple[
    LoggerProvider, LoggingHandler
]:
    logger.info("Initializing OpenTelemetry logger provider")
    with ExitStack() as stack:
        logger_provider = LoggerProvider(resource=_server_resource())
        stack.callback(logger_provider.shutdown)
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
        handler = LoggingHandler(logger_provider=logger_provider)
        logging.getLogger().addHandler(handler)
        stack.callback(logging.getLogger().removeHandler, handler)
        logger.info("🔭 OpenTelemetry logger provider initialized")
        stack.pop_all()
        return logger_provider, handler


@dataclass
class ServerTelemetry:
    """Owns the server's OpenTelemetry providers, root log handler, and engine listeners."""

    tracer_provider: Optional[TracerProvider] = None
    logger_provider: Optional[LoggerProvider] = None
    _log_handler: Optional[LoggingHandler] = None
    _cleanups: list[Callable[[], None]] = field(default_factory=list)
    _closed: bool = False

    @classmethod
    def from_env(cls) -> "ServerTelemetry":
        """Construct server telemetry from ``PHOENIX_SERVER_INSTRUMENTATION_OTLP_*`` env vars."""
        telemetry = cls()
        try:
            if server_log_export_is_enabled():
                logger_provider, handler = _initialize_opentelemetry_logger_provider_with_handler()
                telemetry.logger_provider = logger_provider
                telemetry._log_handler = handler
            if server_instrumentation_is_enabled():
                telemetry.tracer_provider = initialize_opentelemetry_tracer_provider()
        except BaseException:
            telemetry.close()
            raise
        return telemetry

    def instrument_engine(self, engine: AsyncEngine) -> Callable[[], None]:
        """Instrument ``engine`` when server tracing is enabled and register cleanup on close."""
        if self.tracer_provider is None:
            return lambda: None
        uninstrument = instrument_sqlalchemy_engine(engine, tracer_provider=self.tracer_provider)
        self._cleanups.append(uninstrument)
        return uninstrument

    def close(self) -> None:
        """Detach engine listeners, remove the root log handler, and shut down providers."""
        if self._closed:
            return
        self._closed = True
        first_error: Optional[BaseException] = None
        for cleanup in reversed(self._cleanups):
            try:
                cleanup()
            except BaseException as exc:
                if first_error is None:
                    first_error = exc
                logger.exception("Error while detaching server telemetry listener")
        self._cleanups.clear()

        if self._log_handler is not None:
            logging.getLogger().removeHandler(self._log_handler)
            self._log_handler = None

        if self.tracer_provider is not None:
            shutdown = getattr(self.tracer_provider, "shutdown", None)
            if callable(shutdown):
                try:
                    shutdown()
                except BaseException as exc:
                    if first_error is None:
                        first_error = exc
                    logger.exception("Error shutting down server tracer provider")

        if self.logger_provider is not None:
            try:
                self.logger_provider.shutdown()
            except BaseException as exc:
                if first_error is None:
                    first_error = exc
                logger.exception("Error shutting down server logger provider")

        if first_error is not None:
            raise first_error

    def __enter__(self) -> "ServerTelemetry":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


def _extract_sql_operation(statement: str) -> Optional[str]:
    stripped = _LEADING_SQL_COMMENT_RE.sub("", statement, count=1)
    match = _LEADING_SQL_KEYWORD_RE.match(stripped)
    return match.group(0).upper() if match is not None else None


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

    Requires an active parent span belonging to ``tracer_provider`` and unsuppressed
    instrumentation.

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

    # Connection.info can trigger reconnection during error handling. Each entry
    # pairs the execution tag (ExecutionContext when present, otherwise cursor)
    # with its Span so nested suppressed or post-cursor errors cannot pop an
    # enclosing execution's span.
    in_flight_spans: weakref.WeakKeyDictionary[SAConnection, list[tuple[object, Span]]] = (
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
        if is_otel_instrumentation_suppressed():
            return
        parent_context = resolve_server_parent_context(tracer_provider)
        if parent_context is None:
            return
        tag: object = execution_context if execution_context is not None else cursor
        if tag is None:
            return
        operation = _extract_sql_operation(statement)
        span_name = _format_sql_span_name(
            operation=operation,
            db_name=db_name,
            db_system=db_system,
        )
        span = tracer.start_span(span_name, context=parent_context, kind=SpanKind.CLIENT)
        if span.is_recording():
            span.set_attributes(base_attributes)
            if operation is not None:
                span.set_attribute(_DB_OPERATION, operation)
            span.set_attribute(_DB_STATEMENT, statement)
        in_flight_spans.setdefault(connection, []).append((tag, span))

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
        tag: object = execution_context if execution_context is not None else cursor
        if spans[-1][0] is not tag:
            return
        _, span = spans.pop()
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
        tag: object = (
            exception_context.execution_context
            if exception_context.execution_context is not None
            else exception_context.cursor
        )
        if tag is None or spans[-1][0] is not tag:
            return
        _, span = spans.pop()
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
