"""App-scoped OpenTelemetry tracing and logging for the Phoenix server.

Phoenix owns its SQLAlchemy cursor listeners and stdlib log handler rather than
using ``opentelemetry-instrumentation-sqlalchemy`` or ``opentelemetry-sdk``'s
deprecated ``LoggingHandler`` because:

1. Upstream ``BaseInstrumentor`` subclasses are process-wide singletons that
   monkey-patch global constructors and tear down all listeners globally on
   ``uninstrument()``, breaking embedded ``phoenix.launch_app()`` sessions and
   multi-engine setups (primary + SQLite read pool / PostgreSQL replica).
2. Phoenix runs two OpenTelemetry planes in the same event loop (server APM and
   in-process OpenInference tracing for agents/evaluators). Upstream
   instrumentors always parent spans to the ambient OpenTelemetry ``Context``,
   which ``detached_otel_context()`` replaces during OpenInference runs.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import threading
import weakref
from collections.abc import Callable, Generator, Mapping, Sequence
from contextlib import ExitStack, contextmanager, suppress
from contextvars import ContextVar
from dataclasses import dataclass
from pathlib import Path
from time import time_ns
from typing import Any, Final, Self

from opentelemetry import _logs as otel_logs
from opentelemetry import context as otel_context
from opentelemetry import trace
from opentelemetry._logs import Logger as ApiLogger
from opentelemetry._logs import LoggerProvider as ApiLoggerProvider
from opentelemetry._logs import LogRecord as ApiLogRecord
from opentelemetry._logs import NoOpLogger, NoOpLoggerProvider, SeverityNumber
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, SpanLimits, SpanProcessor
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
from opentelemetry.semconv.attributes.server_attributes import SERVER_ADDRESS, SERVER_PORT
from opentelemetry.semconv.attributes.service_attributes import SERVICE_NAME, SERVICE_VERSION
from opentelemetry.semconv.schemas import Schemas
from opentelemetry.trace import (
    Link,
    NoOpTracerProvider,
    Span,
    SpanKind,
    Status,
    StatusCode,
    Tracer,
    TracerProvider,
)
from opentelemetry.util._decorator import _agnosticcontextmanager
from opentelemetry.util.types import Attributes
from sqlalchemy import URL, event
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
from phoenix.server.lifecycle import raise_cleanup_errors
from phoenix.version import __version__

logger = logging.getLogger(__name__)

_SERVICE_NAME: Final[str] = "arize-phoenix-server"
_OTLP_HTTP_TRACES_PATH: Final[str] = "/v1/traces"
_OTLP_HTTP_LOGS_PATH: Final[str] = "/v1/logs"
SCHEMA_URL: Final[str] = Schemas.V1_44_0.value
_POSTGRESQL_DEFAULT_PORT: Final[int] = 5432
_MAX_SPAN_ATTRIBUTE_LENGTH: Final[int] = 8192
_MAX_LOG_ATTR_DEPTH: Final[int] = 8

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


class _ProviderSpanRegistry(SpanProcessor):
    """Track live spans created by a specific ``SdkTracerProvider`` using public hooks."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._parent_by_span_id: dict[int, int | None] = {}

    def on_start(
        self,
        span: Span,
        parent_context: otel_context.Context | None = None,
    ) -> None:
        span_id = span.get_span_context().span_id
        parent = span.parent if isinstance(span, ReadableSpan) else None
        parent_id = parent.span_id if parent is not None else None
        with self._lock:
            self._parent_by_span_id[span_id] = parent_id

    def on_end(self, span: ReadableSpan) -> None:
        ctx = span.get_span_context()
        if ctx is None:
            return
        with self._lock:
            self._parent_by_span_id.pop(ctx.span_id, None)

    def contains(self, span: Span) -> bool:
        context = span.get_span_context()
        if not context.is_valid:
            return False
        with self._lock:
            return context.span_id in self._parent_by_span_id

    def is_descendant(self, candidate: Span, ancestor: Span) -> bool:
        candidate_ctx = candidate.get_span_context()
        ancestor_ctx = ancestor.get_span_context()
        if (
            not candidate_ctx.is_valid
            or not ancestor_ctx.is_valid
            or candidate_ctx.trace_id != ancestor_ctx.trace_id
            or candidate_ctx.span_id == ancestor_ctx.span_id
        ):
            return False
        target_id = ancestor_ctx.span_id
        with self._lock:
            current_id: int | None = candidate_ctx.span_id
            for _ in range(64):
                if current_id is None or current_id not in self._parent_by_span_id:
                    return False
                parent_id = self._parent_by_span_id[current_id]
                if parent_id == target_id:
                    return True
                current_id = parent_id
        return False


_SPAN_REGISTRIES_LOCK = threading.Lock()
_SPAN_REGISTRIES: weakref.WeakKeyDictionary[Any, _ProviderSpanRegistry] = (
    weakref.WeakKeyDictionary()
)


def _ensure_span_registry(tracer_provider: TracerProvider) -> _ProviderSpanRegistry | None:
    add_processor = getattr(tracer_provider, "add_span_processor", None)
    if not callable(add_processor):
        return None
    with _SPAN_REGISTRIES_LOCK:
        registry = _SPAN_REGISTRIES.get(tracer_provider)
        if registry is None:
            registry = _ProviderSpanRegistry()
            add_processor(registry)
            _SPAN_REGISTRIES[tracer_provider] = registry
        return registry


@dataclass(frozen=True, slots=True)
class _BoundServerSpan:
    tracer_provider: TracerProvider
    span: Span


# Independent of OpenTelemetry's Context dict so OpenInference detachment preserves it.
_CURRENT_SERVER_SPAN: ContextVar[_BoundServerSpan | None] = ContextVar(
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


def _unwrap_tracer_provider(tracer_provider: TracerProvider | None) -> TracerProvider | None:
    if isinstance(tracer_provider, _LifespanTracerProvider):
        return tracer_provider.current_provider
    return tracer_provider


@contextmanager
def bind_server_span(
    span: Span, tracer_provider: TracerProvider | None
) -> Generator[None, None, None]:
    """Bind ``span`` as the active server-instrumentation parent in ``contextvars``."""
    active_provider = _unwrap_tracer_provider(tracer_provider)
    if active_provider is None or not span.get_span_context().is_valid:
        yield
        return
    _ensure_span_registry(active_provider)
    token = _CURRENT_SERVER_SPAN.set(_BoundServerSpan(tracer_provider=active_provider, span=span))
    try:
        yield
    finally:
        try:
            _CURRENT_SERVER_SPAN.reset(token)
        except ValueError:
            # Async generators (e.g. SSE subscriptions) can finalize in another task/Context.
            pass


def resolve_server_parent_context(
    tracer_provider: TracerProvider,
) -> otel_context.Context | None:
    """Return an OpenTelemetry ``Context`` carrying ``tracer_provider``'s active server span.

    When a server span is bound in ``_CURRENT_SERVER_SPAN``, prefers an ambient
    span only if it is a live descendant of that bound span on ``tracer_provider``
    (such as FastAPI's ``fastapi.endpoint`` inside ``GET /path``), and otherwise
    uses the bound span itself.
    """
    active_provider = _unwrap_tracer_provider(tracer_provider)
    if active_provider is None:
        return None
    ambient_span = trace.get_current_span()
    binding = _CURRENT_SERVER_SPAN.get()
    registry = _SPAN_REGISTRIES.get(active_provider)
    if binding is not None and binding.tracer_provider is active_provider:
        if registry is not None and registry.is_descendant(ambient_span, binding.span):
            return trace.set_span_in_context(ambient_span, otel_context.Context())
        return trace.set_span_in_context(binding.span, otel_context.Context())
    if registry is not None and registry.contains(ambient_span):
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


def _coerce_otel_attribute_value(value: Any, _depth: int = 0) -> Any:
    if isinstance(value, (bool, bytes, int, float, str)):
        return value
    if _depth >= _MAX_LOG_ATTR_DEPTH:
        return str(value)
    if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
        return [_coerce_otel_attribute_value(item, _depth + 1) for item in value]
    if isinstance(value, Mapping):
        return {str(k): _coerce_otel_attribute_value(v, _depth + 1) for k, v in value.items()}
    return str(value)


class _OtelLoggingHandler(logging.Handler):
    """Bridge stdlib ``logging`` records to an OpenTelemetry ``LoggerProvider``."""

    def __init__(
        self,
        *,
        logger_provider: ApiLoggerProvider,
        tracer_provider: TracerProvider | None = None,
        level: int = logging.NOTSET,
    ) -> None:
        super().__init__(level=level)
        self._logger_provider = logger_provider
        self._tracer_provider = tracer_provider

    def emit(self, record: logging.LogRecord) -> None:
        if is_otel_instrumentation_suppressed():
            return
        try:
            otel_logger = otel_logs.get_logger(
                record.name,
                schema_url=SCHEMA_URL,
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

            exception: BaseException | None = (
                record.exc_info[1] if record.exc_info and record.exc_info[1] is not None else None
            )

            if self.formatter is not None:
                body: Any = self.format(record)
            elif not record.args and not isinstance(record.msg, str):
                body = (
                    record.msg
                    if isinstance(record.msg, (type(None), bool, bytes, int, float))
                    or (
                        isinstance(record.msg, (Sequence, Mapping))
                        and not isinstance(record.msg, bytearray)
                    )
                    else str(record.msg)
                )
            else:
                body = record.getMessage()

            context: otel_context.Context | None = None
            if self._tracer_provider is not None:
                context = resolve_server_parent_context(self._tracer_provider)
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
        except Exception:
            self.handleError(record)


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
        schema_url=SCHEMA_URL,
    )


def initialize_opentelemetry_tracer_provider() -> SdkTracerProvider:
    """Construct the server's ``SdkTracerProvider`` with configured OTLP span exporters."""
    logger.info("Initializing OpenTelemetry tracer provider")
    with ExitStack() as stack:
        tracer_provider = SdkTracerProvider(
            resource=_server_resource(),
            shutdown_on_exit=False,
            span_limits=SpanLimits(max_attribute_length=_MAX_SPAN_ATTRIBUTE_LENGTH),
        )
        stack.callback(tracer_provider.shutdown)
        _ensure_span_registry(tracer_provider)
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


def initialize_opentelemetry_logger_provider() -> LoggerProvider:
    """Construct the server's ``LoggerProvider`` with configured OTLP log exporters."""
    logger.info("Initializing OpenTelemetry logger provider")
    with ExitStack() as stack:
        logger_provider = LoggerProvider(resource=_server_resource(), shutdown_on_exit=False)
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
        logger.info("🔭 OpenTelemetry logger provider initialized")
        stack.pop_all()
        return logger_provider


class ServerTelemetry:
    """Owns the server's OpenTelemetry providers, root log handler, and engine listeners."""

    def __init__(
        self,
        *,
        tracer_provider: SdkTracerProvider | None = None,
        logger_provider: LoggerProvider | None = None,
    ) -> None:
        self.tracer_provider = tracer_provider
        self.logger_provider = logger_provider
        if tracer_provider is not None:
            _ensure_span_registry(tracer_provider)
        self._log_handler: logging.Handler | None = None
        self._cleanups: list[Callable[[], None]] = []
        self._lock = threading.Lock()
        self._closed = False

    @classmethod
    def from_env(cls) -> Self:
        """Construct server telemetry from ``PHOENIX_SERVER_INSTRUMENTATION_OTLP_*`` env vars."""
        telemetry = cls()
        try:
            if server_instrumentation_is_enabled():
                telemetry.tracer_provider = initialize_opentelemetry_tracer_provider()
                _ensure_span_registry(telemetry.tracer_provider)
            if server_log_export_is_enabled():
                logger_provider = initialize_opentelemetry_logger_provider()
                telemetry.logger_provider = logger_provider
                handler = _OtelLoggingHandler(
                    logger_provider=logger_provider,
                    tracer_provider=telemetry.tracer_provider,
                )
                logging.getLogger().addHandler(handler)
                telemetry._log_handler = handler
        except BaseException as setup_err:
            should_flush = not isinstance(setup_err, (asyncio.CancelledError, KeyboardInterrupt))
            try:
                telemetry.close(flush=should_flush)
            except Exception as cleanup_err:
                setup_err.add_note(
                    f"ServerTelemetry cleanup after setup failure also raised: {cleanup_err!r}"
                )
            raise
        return telemetry

    def instrument_engine(self, engine: AsyncEngine) -> Callable[[], None]:
        """Instrument ``engine`` when server tracing is enabled and register cleanup on close."""
        with self._lock:
            if self._closed:
                raise RuntimeError("Cannot instrument engine on closed ServerTelemetry")
            if self.tracer_provider is None:
                return lambda: None
            uninstrument = instrument_sqlalchemy_engine(
                engine, tracer_provider=self.tracer_provider
            )
            self._cleanups.append(uninstrument)
            return uninstrument

    def close(self, *, flush: bool = True) -> None:
        """Detach engine listeners, remove the root log handler, and shut down providers."""
        with self._lock:
            if self._closed:
                return
            self._closed = True
            cleanups = list(reversed(self._cleanups))
            self._cleanups.clear()
            handler = self._log_handler
            self._log_handler = None

            errors: list[Exception] = []
            for cleanup in cleanups:
                try:
                    cleanup()
                except Exception as exc:
                    errors.append(exc)
                    logger.exception("Error while detaching server telemetry listener")

            if handler is not None:
                logging.getLogger().removeHandler(handler)

            if flush and self.tracer_provider is not None:
                try:
                    self.tracer_provider.shutdown()
                except Exception as exc:
                    errors.append(exc)
                    logger.exception("Error shutting down server tracer provider")

            if flush and self.logger_provider is not None:
                try:
                    self.logger_provider.shutdown()
                except Exception as exc:
                    errors.append(exc)
                    logger.exception("Error shutting down server logger provider")

            raise_cleanup_errors("Failed to close server telemetry cleanly", errors)

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


class _DelegatingTracer(Tracer):
    def __init__(
        self,
        owner: _LifespanTracerProvider,
        instrumenting_module_name: str,
        instrumenting_library_version: str | None,
        schema_url: str | None,
        attributes: Attributes,
    ) -> None:
        self._owner = owner
        self._module_name = instrumenting_module_name
        self._version = instrumenting_library_version
        self._schema_url = schema_url
        self._attributes = attributes

    def _target(self) -> Tracer:
        provider = self._owner.current_provider or NoOpTracerProvider()
        return provider.get_tracer(
            self._module_name,
            self._version,
            self._schema_url,
            self._attributes,
        )

    def start_span(
        self,
        name: str,
        context: otel_context.Context | None = None,
        kind: SpanKind = SpanKind.INTERNAL,
        attributes: Attributes = None,
        links: Sequence[Link] | None = (),
        start_time: int | None = None,
        record_exception: bool = True,
        set_status_on_exception: bool = True,
    ) -> Span:
        return self._target().start_span(
            name=name,
            context=context,
            kind=kind,
            attributes=attributes,
            links=links,
            start_time=start_time,
            record_exception=record_exception,
            set_status_on_exception=set_status_on_exception,
        )

    @_agnosticcontextmanager
    def start_as_current_span(
        self,
        name: str,
        context: otel_context.Context | None = None,
        kind: SpanKind = SpanKind.INTERNAL,
        attributes: Attributes = None,
        links: Sequence[Link] | None = (),
        start_time: int | None = None,
        record_exception: bool = True,
        set_status_on_exception: bool = True,
        end_on_exit: bool = True,
    ) -> Generator[Span, None, None]:
        with self._target().start_as_current_span(
            name=name,
            context=context,
            kind=kind,
            attributes=attributes,
            links=links,
            start_time=start_time,
            record_exception=record_exception,
            set_status_on_exception=set_status_on_exception,
            end_on_exit=end_on_exit,
        ) as span:
            yield span


class _LifespanTracerProvider(TracerProvider):
    """Delegate tracing to the ``SdkTracerProvider`` owned by the active ASGI lifespan."""

    def __init__(self, slot: LifespanServerTelemetry) -> None:
        self._slot = slot

    @property
    def current_provider(self) -> SdkTracerProvider | None:
        current = self._slot.current
        return current.tracer_provider if current is not None else None

    def get_tracer(
        self,
        instrumenting_module_name: str,
        instrumenting_library_version: str | None = None,
        schema_url: str | None = None,
        attributes: Attributes = None,
    ) -> Tracer:
        return _DelegatingTracer(
            self,
            instrumenting_module_name,
            instrumenting_library_version,
            schema_url,
            attributes,
        )


class _DelegatingLogger(ApiLogger):
    def __init__(
        self,
        owner: _LifespanLoggerProvider,
        name: str,
        version: str | None,
        schema_url: str | None,
        attributes: Attributes,
    ) -> None:
        super().__init__(name, version, schema_url, attributes)
        self._owner = owner

    def _target(self) -> ApiLogger:
        provider: ApiLoggerProvider = self._owner.current_provider or NoOpLoggerProvider()
        return provider.get_logger(self._name, self._version, self._schema_url, self._attributes)

    def enabled(
        self,
        *,
        context: otel_context.Context | None = None,
        severity_number: SeverityNumber | None = None,
        event_name: str | None = None,
    ) -> bool:
        target = self._target()
        enabled_fn = getattr(target, "enabled", None)
        if callable(enabled_fn):
            return bool(
                enabled_fn(
                    context=context,
                    severity_number=severity_number,
                    event_name=event_name,
                )
            )
        return not isinstance(target, NoOpLogger)

    def emit(
        self,
        record: ApiLogRecord | None = None,
        *,
        timestamp: int | None = None,
        observed_timestamp: int | None = None,
        context: otel_context.Context | None = None,
        severity_number: SeverityNumber | None = None,
        severity_text: str | None = None,
        body: Any = None,
        attributes: Attributes = None,
        event_name: str | None = None,
        exception: BaseException | None = None,
    ) -> None:
        target = self._target()
        if record is not None:
            target.emit(record)
        else:
            target.emit(
                timestamp=timestamp,
                observed_timestamp=observed_timestamp,
                context=context,
                severity_number=severity_number,
                severity_text=severity_text,
                body=body,
                attributes=attributes,
                event_name=event_name,
                exception=exception,
            )


class _LifespanLoggerProvider(ApiLoggerProvider):
    """Delegate log emission to the ``LoggerProvider`` owned by the active ASGI lifespan."""

    def __init__(self, slot: LifespanServerTelemetry) -> None:
        self._slot = slot

    @property
    def current_provider(self) -> LoggerProvider | None:
        current = self._slot.current
        return current.logger_provider if current is not None else None

    def get_logger(
        self,
        name: str,
        version: str | None = None,
        schema_url: str | None = None,
        attributes: Attributes = None,
    ) -> ApiLogger:
        return _DelegatingLogger(self, name, version, schema_url, attributes)


class LifespanServerTelemetry:
    """Create a fresh ``ServerTelemetry`` per ASGI lifespan for direct ``create_app`` calls."""

    def __init__(self) -> None:
        self.current: ServerTelemetry | None = None
        self.tracer_provider: TracerProvider | None = (
            _LifespanTracerProvider(self) if server_instrumentation_is_enabled() else None
        )
        self.logger_provider: ApiLoggerProvider | None = (
            _LifespanLoggerProvider(self) if server_log_export_is_enabled() else None
        )

    def enter(self) -> ServerTelemetry:
        telemetry = ServerTelemetry.from_env()
        self.current = telemetry
        return telemetry

    def close(self, *, flush: bool = True) -> None:
        telemetry = self.current
        self.current = None
        if telemetry is not None:
            telemetry.close(flush=flush)


def _extract_sql_operation(statement: str) -> str | None:
    stripped = _LEADING_SQL_COMMENT_RE.sub("", statement, count=1)
    match = _LEADING_SQL_KEYWORD_RE.match(stripped)
    if match is None:
        return None
    keyword = match.group(0)
    # CTE prefixes do not identify the underlying DML/DQL operation.
    if keyword.upper() == "WITH":
        return None
    return keyword


def _sanitize_db_namespace(db_system_name: str, raw_database: str | None) -> str | None:
    if not raw_database:
        return None
    if db_system_name != "sqlite":
        return raw_database
    target = raw_database.removeprefix("file:").split("?", 1)[0]
    if target == ":memory:" or not target:
        return ":memory:" if ":memory:" in raw_database else None
    return Path(target).name or None


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
    seen: set[int] = set()
    candidate: BaseException | None = exception
    while candidate is not None and id(candidate) not in seen:
        seen.add(id(candidate))
        sqlstate = getattr(candidate, "sqlstate", None) or getattr(candidate, "pgcode", None)
        if isinstance(sqlstate, str) and sqlstate:
            return sqlstate
        sqlite_code = getattr(candidate, "sqlite_errorcode", None)
        if isinstance(sqlite_code, int):
            return str(sqlite_code)
        candidate = candidate.__cause__ or candidate.__context__
    return None


def _batch_size(parameters: Any, executemany: bool) -> int | None:
    if not executemany or not isinstance(parameters, Sequence):
        return None
    if isinstance(parameters, (str, bytes, bytearray)):
        return None
    size = len(parameters)
    return size if size >= 2 else None


def _extract_db_engine_attributes(
    dialect_name: str,
    url: URL,
) -> tuple[dict[str, str | int], str | None]:
    db_namespace = _sanitize_db_namespace(dialect_name, url.database)
    server_address = url.host or None
    raw_port = url.port
    server_port = (
        None
        if raw_port is None
        or (dialect_name == "postgresql" and raw_port == _POSTGRESQL_DEFAULT_PORT)
        else raw_port
    )
    target = _format_sql_target(
        db_namespace=db_namespace,
        server_address=server_address,
        server_port=server_port,
    )
    base_attributes: dict[str, str | int] = {DB_SYSTEM_NAME: dialect_name}
    if db_namespace:
        base_attributes[DB_NAMESPACE] = db_namespace
    if server_address:
        base_attributes[SERVER_ADDRESS] = server_address
    if server_port is not None:
        base_attributes[SERVER_PORT] = server_port
    return base_attributes, target


class _SqlAlchemyEngineTracer:
    """Per-engine SQLAlchemy cursor and error event listener."""

    def __init__(self, engine: AsyncEngine, *, tracer_provider: TracerProvider) -> None:
        _ensure_span_registry(tracer_provider)
        self._sync_engine = engine.sync_engine
        self._tracer_provider = tracer_provider
        self._tracer = tracer_provider.get_tracer(
            "phoenix.server.db",
            __version__,
            schema_url=SCHEMA_URL,
        )
        self._db_system_name = self._sync_engine.dialect.name
        self._base_attributes, self._target = _extract_db_engine_attributes(
            self._db_system_name, self._sync_engine.url
        )
        # Connection.info can trigger reconnection during error handling.
        self._in_flight_spans: weakref.WeakKeyDictionary[
            SAConnection, list[tuple[object, Span]]
        ] = weakref.WeakKeyDictionary()
        self._record_to_proxy: weakref.WeakKeyDictionary[Any, Any] = weakref.WeakKeyDictionary()
        self._proxy_to_conn: weakref.WeakKeyDictionary[Any, SAConnection] = (
            weakref.WeakKeyDictionary()
        )
        self._listeners: list[tuple[str, Callable[..., Any]]] = [
            ("checkout", self._on_checkout),
            ("before_cursor_execute", self._before_cursor_execute),
            ("after_cursor_execute", self._after_cursor_execute),
            ("handle_error", self._handle_error),
            ("checkin", self._on_checkin),
        ]
        for identifier, fn in self._listeners:
            event.listen(self._sync_engine, identifier, fn)

    def _on_checkout(
        self, dbapi_connection: Any, connection_record: Any, connection_proxy: Any
    ) -> None:
        if connection_record is not None and connection_proxy is not None:
            self._record_to_proxy[connection_record] = connection_proxy

    def _on_checkin(self, dbapi_connection: Any, connection_record: Any) -> None:
        if connection_record is None:
            return
        proxy = self._record_to_proxy.pop(connection_record, None)
        if proxy is None:
            return
        connection = self._proxy_to_conn.get(proxy)
        if connection is None or connection.in_transaction():
            return
        # ``BaseException`` (e.g. ``asyncio.CancelledError``) bypasses SQLAlchemy's
        # ``after_cursor_execute`` and ``handle_error``; end any orphaned spans as ``UNSET``.
        spans = self._in_flight_spans.pop(connection, None)
        if spans:
            for _, span in reversed(spans):
                span.end()

    def _before_cursor_execute(
        self,
        connection: SAConnection,
        cursor: Any,
        statement: str,
        parameters: Any,
        execution_context: ExecutionContext | None,
        executemany: bool,
    ) -> None:
        if is_otel_instrumentation_suppressed():
            return
        parent_context = resolve_server_parent_context(self._tracer_provider)
        if parent_context is None:
            return
        tag: object = execution_context if execution_context is not None else cursor
        keyword = _extract_sql_operation(statement)
        batch_size = _batch_size(parameters, executemany)
        if batch_size is not None:
            operation_name: str | None = f"BATCH {keyword}" if keyword is not None else "BATCH"
        else:
            operation_name = keyword
        span_name = _format_sql_span_name(
            operation_name=operation_name,
            target=self._target,
            db_system_name=self._db_system_name,
        )
        span = self._tracer.start_span(span_name, context=parent_context, kind=SpanKind.CLIENT)
        if span.is_recording():
            span.set_attributes(self._base_attributes)
            if operation_name is not None:
                span.set_attribute(DB_OPERATION_NAME, operation_name)
            if batch_size is not None:
                span.set_attribute(DB_OPERATION_BATCH_SIZE, batch_size)
            span.set_attribute(DB_QUERY_TEXT, statement[:_MAX_SPAN_ATTRIBUTE_LENGTH])
        if not connection.invalidated and not connection.closed:
            with suppress(Exception):
                self._proxy_to_conn[connection.connection] = connection
        self._in_flight_spans.setdefault(connection, []).append((tag, span))

    def _after_cursor_execute(
        self,
        connection: SAConnection,
        cursor: Any,
        statement: str,
        parameters: Any,
        execution_context: ExecutionContext | None,
        executemany: bool,
    ) -> None:
        spans = self._in_flight_spans.get(connection)
        if not spans:
            return
        tag: object = execution_context if execution_context is not None else cursor
        if spans[-1][0] is not tag:
            return
        _, span = spans.pop()
        if not spans:
            self._in_flight_spans.pop(connection, None)
        span.end()

    def _handle_error(self, exception_context: ExceptionContext) -> None:
        connection = exception_context.connection
        if connection is None:
            return
        spans = self._in_flight_spans.get(connection)
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
            self._in_flight_spans.pop(connection, None)
        exception = exception_context.original_exception
        if span.is_recording() and not isinstance(exception, asyncio.CancelledError):
            status_code = _extract_db_status_code(exception)
            if status_code is not None:
                span.set_attribute(DB_RESPONSE_STATUS_CODE, status_code)
            span.set_attribute(ERROR_TYPE, exception_type_name(exception))
            span.record_exception(exception)
            span.set_status(Status(StatusCode.ERROR, str(exception)))
        span.end()

    def uninstrument(self) -> None:
        for identifier, fn in self._listeners:
            if event.contains(self._sync_engine, identifier, fn):
                event.remove(self._sync_engine, identifier, fn)


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
    return _SqlAlchemyEngineTracer(engine, tracer_provider=tracer_provider).uninstrument
