from __future__ import annotations

import logging
import os
import re
import weakref
from collections.abc import Callable, Generator, Mapping, Sequence
from contextlib import ExitStack, contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from time import time_ns
from typing import Any, Final, Self

from opentelemetry import _logs as otel_logs
from opentelemetry import context as otel_context
from opentelemetry import trace
from opentelemetry._logs import LoggerProvider as ApiLoggerProvider
from opentelemetry._logs import NoOpLogger, SeverityNumber
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider as SdkTracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.semconv.attributes.code_attributes import (
    CODE_FILE_PATH,
    CODE_FUNCTION_NAME,
    CODE_LINE_NUMBER,
)
from opentelemetry.semconv.attributes.db_attributes import (
    DB_NAMESPACE,
    DB_OPERATION_BATCH_SIZE,
    DB_OPERATION_NAME,
    DB_QUERY_TEXT,
    DB_RESPONSE_STATUS_CODE,
    DB_SYSTEM_NAME,
)
from opentelemetry.semconv.attributes.error_attributes import ERROR_TYPE
from opentelemetry.semconv.attributes.exception_attributes import (
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
    EXCEPTION_TYPE,
)
from opentelemetry.semconv.attributes.server_attributes import SERVER_ADDRESS, SERVER_PORT
from opentelemetry.semconv.attributes.service_attributes import SERVICE_NAME, SERVICE_VERSION
from opentelemetry.semconv.schemas import Schemas
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

_SERVICE_NAME: Final[str] = "arize-phoenix-server"
_OTLP_HTTP_TRACES_PATH: Final[str] = "/v1/traces"
_OTLP_HTTP_LOGS_PATH: Final[str] = "/v1/logs"
_SCHEMA_URL: Final[str] = Schemas.V1_44_0.value
_POSTGRESQL_DEFAULT_PORT: Final[int] = 5432

_SUPPRESS_INSTRUMENTATION_KEY: Final[str | None] = getattr(
    otel_context, "_SUPPRESS_INSTRUMENTATION_KEY", None
)
_LEADING_SQL_COMMENT_RE = re.compile(r"^(?:\s+|--[^\n]*(?:\n|$)|/\*[\s\S]*?\*/)*")
_LEADING_SQL_KEYWORD_RE = re.compile(r"^[A-Za-z_]+")

_STD_LOG_RESERVED_ATTRS: Final[frozenset[str]] = frozenset(
    {
        "args",
        "asctime",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "getMessage",
        "levelname",
        "levelno",
        "lineno",
        "message",
        "module",
        "msecs",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "taskName",
        "thread",
        "threadName",
    }
)
_PYTHON_TO_OTEL_SEVERITY_TEXT: Final[dict[str, str]] = {
    "WARNING": "WARN",
    "CRITICAL": "FATAL",
}

# Independent of OpenTelemetry's Context so OpenInference detachment preserves it.
# Stores (tracer_provider, bound_span, ambient_at_bind_time) so inner framework
# spans from the same provider (e.g. FastAPI's fastapi.endpoint) win while no
# closer Phoenix span (e.g. GraphQL Resolving) has overridden them.
_CURRENT_SERVER_SPAN: ContextVar[tuple[TracerProvider, Span, Span] | None] = ContextVar(
    "phoenix_current_server_span", default=None
)


def is_otel_instrumentation_suppressed() -> bool:
    """Return whether OpenTelemetry instrumentation is suppressed."""
    return bool(
        _SUPPRESS_INSTRUMENTATION_KEY is not None
        and otel_context.get_value(_SUPPRESS_INSTRUMENTATION_KEY)
    )


def exception_type_name(exception: BaseException) -> str:
    """Return the canonical qualified class name for ``error.type``."""
    cls = type(exception)
    return (
        f"{cls.__module__}.{cls.__qualname__}" if cls.__module__ != "builtins" else cls.__qualname__
    )


def _belongs_to_tracer_provider(span: Span, tracer_provider: TracerProvider) -> bool:
    if not span.get_span_context().is_valid:
        return False
    provider_processor = getattr(tracer_provider, "_active_span_processor", None)
    span_processor = getattr(span, "_span_processor", None)
    return provider_processor is not None and span_processor is provider_processor


@contextmanager
def bind_server_span(
    span: Span, tracer_provider: TracerProvider | None
) -> Generator[None, None, None]:
    """Bind a server span and its provider without changing the OpenInference context."""
    binding = (
        (tracer_provider, span, trace.get_current_span())
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
) -> otel_context.Context | None:
    """Return an OpenTelemetry ``Context`` carrying ``tracer_provider``'s active server span."""
    ambient_span = trace.get_current_span()
    binding = _CURRENT_SERVER_SPAN.get()
    if binding is not None and binding[0] is tracer_provider:
        _, bound_span, ambient_at_bind = binding
        if (
            ambient_span is not bound_span
            and ambient_span is not ambient_at_bind
            and _belongs_to_tracer_provider(ambient_span, tracer_provider)
        ):
            return trace.set_span_in_context(ambient_span, otel_context.Context())
        return trace.set_span_in_context(bound_span, otel_context.Context())
    if _belongs_to_tracer_provider(ambient_span, tracer_provider):
        return trace.set_span_in_context(ambient_span, otel_context.Context())
    return None


def _std_level_to_severity_number(levelno: int) -> SeverityNumber:
    if levelno < 10:
        return SeverityNumber.UNSPECIFIED
    if levelno < 20:
        return SeverityNumber(min(SeverityNumber.DEBUG.value + (levelno - 10), 8))
    if levelno < 30:
        return SeverityNumber(min(SeverityNumber.INFO.value + (levelno - 20), 12))
    if levelno < 40:
        return SeverityNumber(min(SeverityNumber.WARN.value + (levelno - 30), 16))
    if levelno < 50:
        return SeverityNumber(min(SeverityNumber.ERROR.value + (levelno - 40), 20))
    return SeverityNumber(min(SeverityNumber.FATAL.value + (levelno - 50), 24))


def _coerce_otel_attribute_value(value: Any) -> Any:
    if isinstance(value, (bool, bytes, int, float, str)):
        return value
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_coerce_otel_attribute_value(item) for item in value]
    if isinstance(value, Mapping):
        return {str(k): _coerce_otel_attribute_value(v) for k, v in value.items()}
    return str(value)


class _OtelLoggingHandler(logging.Handler):
    """Bridge stdlib ``logging`` records to an OpenTelemetry ``LoggerProvider``.

    Replaces ``opentelemetry.sdk._logs.LoggingHandler`` (deprecated in
    ``opentelemetry-sdk`` 1.45 in favor of the pre-release
    ``opentelemetry-instrumentation-logging`` package) and correlates request
    logs with Phoenix's server span even inside detached OpenInference contexts.
    """

    def __init__(
        self,
        *,
        logger_provider: ApiLoggerProvider,
        tracer_provider_getter: Callable[[], TracerProvider | None] = lambda: None,
        level: int = logging.NOTSET,
    ) -> None:
        super().__init__(level=level)
        self._logger_provider = logger_provider
        self._tracer_provider_getter = tracer_provider_getter

    def emit(self, record: logging.LogRecord) -> None:
        if is_otel_instrumentation_suppressed():
            return
        otel_logger = otel_logs.get_logger(
            record.name,
            schema_url=_SCHEMA_URL,
            logger_provider=self._logger_provider,
        )
        if isinstance(otel_logger, NoOpLogger):
            return

        attributes: dict[str, Any] = {
            key: _coerce_otel_attribute_value(value)
            for key, value in vars(record).items()
            if key not in _STD_LOG_RESERVED_ATTRS and value is not None
        }
        attributes[CODE_FILE_PATH] = record.pathname
        attributes[CODE_FUNCTION_NAME] = record.funcName
        attributes[CODE_LINE_NUMBER] = record.lineno

        exception: BaseException | None = None
        if record.exc_info:
            _, exc_value, _ = record.exc_info
            if exc_value is not None:
                exception = exc_value
                # Preserve existing custom attributes if caller explicitly supplied them.
                attributes.pop(EXCEPTION_TYPE, None)
                attributes.pop(EXCEPTION_MESSAGE, None)
                attributes.pop(EXCEPTION_STACKTRACE, None)

        if self.formatter is not None:
            body: Any = self.format(record)
        elif not record.args and not isinstance(record.msg, str):
            body = (
                record.msg
                if isinstance(record.msg, (type(None), bool, bytes, int, float, Sequence, Mapping))
                else str(record.msg)
            )
        else:
            body = record.getMessage()

        context: otel_context.Context | None = None
        tracer_provider = self._tracer_provider_getter()
        if tracer_provider is not None:
            context = resolve_server_parent_context(tracer_provider)
        if context is None:
            ambient = otel_context.get_current()
            if trace.get_current_span(ambient).get_span_context().is_valid:
                context = ambient

        otel_logger.emit(
            timestamp=int(record.created * 1_000_000_000),
            observed_timestamp=time_ns(),
            context=context,
            severity_number=_std_level_to_severity_number(record.levelno),
            severity_text=_PYTHON_TO_OTEL_SEVERITY_TEXT.get(record.levelname, record.levelname),
            body=body,
            attributes=attributes,
            exception=exception,
        )


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
        },
        schema_url=_SCHEMA_URL,
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


def _initialize_opentelemetry_logger_provider_with_handler(
    *,
    tracer_provider_getter: Callable[[], TracerProvider | None] = lambda: None,
) -> tuple[LoggerProvider, logging.Handler]:
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
        handler = _OtelLoggingHandler(
            logger_provider=logger_provider,
            tracer_provider_getter=tracer_provider_getter,
        )
        logging.getLogger().addHandler(handler)
        stack.callback(logging.getLogger().removeHandler, handler)
        logger.info("🔭 OpenTelemetry logger provider initialized")
        stack.pop_all()
        return logger_provider, handler


def raise_cleanup_errors(message: str, errors: Sequence[BaseException]) -> None:
    """Raise a single cleanup exception directly or bundle multiple into a group."""
    if not errors:
        return
    if len(errors) == 1:
        raise errors[0]
    if all(isinstance(err, Exception) for err in errors):
        raise ExceptionGroup(message, [err for err in errors if isinstance(err, Exception)])
    raise BaseExceptionGroup(message, list(errors))


@dataclass
class ServerTelemetry:
    """Owns the server's OpenTelemetry providers, root log handler, and engine listeners."""

    tracer_provider: TracerProvider | None = None
    logger_provider: LoggerProvider | None = None
    _log_handler: logging.Handler | None = None
    _cleanups: list[Callable[[], None]] = field(default_factory=list)
    _closed: bool = False

    @classmethod
    def from_env(cls) -> Self:
        """Construct server telemetry from ``PHOENIX_SERVER_INSTRUMENTATION_OTLP_*`` env vars."""
        telemetry = cls()
        try:
            if server_instrumentation_is_enabled():
                telemetry.tracer_provider = initialize_opentelemetry_tracer_provider()
            if server_log_export_is_enabled():
                logger_provider, handler = _initialize_opentelemetry_logger_provider_with_handler(
                    tracer_provider_getter=lambda: telemetry.tracer_provider
                )
                telemetry.logger_provider = logger_provider
                telemetry._log_handler = handler
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
        errors: list[BaseException] = []
        for cleanup in reversed(self._cleanups):
            try:
                cleanup()
            except BaseException as exc:
                errors.append(exc)
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
                    errors.append(exc)
                    logger.exception("Error shutting down server tracer provider")

        if self.logger_provider is not None:
            try:
                self.logger_provider.shutdown()
            except BaseException as exc:
                errors.append(exc)
                logger.exception("Error shutting down server logger provider")

        raise_cleanup_errors("Failed to close server telemetry cleanly", errors)

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


def _extract_sql_operation(statement: str) -> str | None:
    stripped = _LEADING_SQL_COMMENT_RE.sub("", statement, count=1)
    match = _LEADING_SQL_KEYWORD_RE.match(stripped)
    return match.group(0).upper() if match is not None else None


def _format_sql_target(
    *,
    db_namespace: str | None,
    server_address: str | None,
    server_port: int | None,
) -> str | None:
    if db_namespace:
        return db_namespace
    if server_address and server_port is not None:
        return f"{server_address}:{server_port}"
    return server_address


def _format_sql_span_name(
    *,
    operation_name: str | None,
    target: str | None,
    db_system_name: str,
) -> str:
    if operation_name and target:
        return f"{operation_name} {target}"
    if operation_name:
        return operation_name
    if target:
        return target
    return db_system_name


def _extract_db_status_code(exception: BaseException) -> str | None:
    for candidate in (exception, getattr(exception, "__cause__", None)):
        if candidate is None:
            continue
        sqlstate = getattr(candidate, "sqlstate", None) or getattr(candidate, "pgcode", None)
        if isinstance(sqlstate, str) and sqlstate:
            return sqlstate
        sqlite_code = getattr(candidate, "sqlite_errorcode", None)
        if isinstance(sqlite_code, int):
            return str(sqlite_code)
    return None


def _batch_size(parameters: Any, executemany: bool) -> int | None:
    if not executemany or not isinstance(parameters, Sequence):
        return None
    if isinstance(parameters, (str, bytes, bytearray)):
        return None
    size = len(parameters)
    return size if size >= 2 else None


def instrument_sqlalchemy_engine(
    engine: AsyncEngine,
    *,
    tracer_provider: TracerProvider,
) -> Callable[[], None]:
    """Attach OpenTelemetry ``CLIENT`` span listeners to one SQLAlchemy ``AsyncEngine``.

    Emits stabilized OpenTelemetry database semantic convention attributes
    (``Schemas.V1_44_0``) when an active parent span belonging to
    ``tracer_provider`` is present and instrumentation is unsuppressed.

    Args:
        engine: The SQLAlchemy async engine whose cursor executions should be traced.
        tracer_provider: The server's OpenTelemetry ``TracerProvider``.

    Returns:
        An idempotent cleanup callable that removes the listeners from ``engine``.
    """
    sync_engine = engine.sync_engine
    tracer = tracer_provider.get_tracer(
        "phoenix.server.db",
        __version__,
        schema_url=_SCHEMA_URL,
    )
    db_system_name = sync_engine.dialect.name
    db_namespace = sync_engine.url.database or None
    server_address = sync_engine.url.host or None
    raw_port = sync_engine.url.port
    server_port = (
        None
        if raw_port is None
        or (db_system_name == "postgresql" and raw_port == _POSTGRESQL_DEFAULT_PORT)
        else raw_port
    )
    target = _format_sql_target(
        db_namespace=db_namespace,
        server_address=server_address,
        server_port=server_port,
    )

    base_attributes: dict[str, str | int] = {DB_SYSTEM_NAME: db_system_name}
    if db_namespace:
        base_attributes[DB_NAMESPACE] = db_namespace
    if server_address:
        base_attributes[SERVER_ADDRESS] = server_address
    if server_port is not None:
        base_attributes[SERVER_PORT] = server_port

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
        execution_context: ExecutionContext | None,
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
        keyword = _extract_sql_operation(statement)
        batch_size = _batch_size(parameters, executemany)
        if batch_size is not None:
            operation_name: str | None = f"BATCH {keyword}" if keyword is not None else "BATCH"
        else:
            operation_name = keyword
        span_name = _format_sql_span_name(
            operation_name=operation_name,
            target=target,
            db_system_name=db_system_name,
        )
        span = tracer.start_span(span_name, context=parent_context, kind=SpanKind.CLIENT)
        if span.is_recording():
            span.set_attributes(base_attributes)
            if operation_name is not None:
                span.set_attribute(DB_OPERATION_NAME, operation_name)
            if batch_size is not None:
                span.set_attribute(DB_OPERATION_BATCH_SIZE, batch_size)
            span.set_attribute(DB_QUERY_TEXT, statement)
        in_flight_spans.setdefault(connection, []).append((tag, span))

    def _after_cursor_execute(
        connection: SAConnection,
        cursor: Any,
        statement: str,
        parameters: Any,
        execution_context: ExecutionContext | None,
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
            status_code = _extract_db_status_code(exception)
            if status_code is not None:
                span.set_attribute(DB_RESPONSE_STATUS_CODE, status_code)
            span.set_attribute(ERROR_TYPE, exception_type_name(exception))
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
