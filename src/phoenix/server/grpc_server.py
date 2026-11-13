"""Phoenix OTLP/gRPC trace ingestion server and per-instance OpenTelemetry tracing.

Phoenix uses an instance-scoped ``TracingServerInterceptor`` rather than
``opentelemetry-instrumentation-grpc`` because ``GrpcAioInstrumentorServer`` is a
process-wide singleton that monkey-patches ``grpc.aio.server`` and does not bind
Phoenix's explicit server-span ``ContextVar`` across OpenInference context
detachment.

Design boundaries:
- Inbound ``traceparent`` / ``tracestate`` metadata is extracted via W3C
  ``TraceContextTextMapPropagator`` (ignoring ``OTEL_PROPAGATORS`` and ``baggage``)
  before ``ApiKeyInterceptor`` runs, matching upstream ``GrpcAioInstrumentorServer``
  so parent-based sampling and distributed traces cover authentication rejections.
- Unhandled servicer exceptions record ``str(exception)`` and stack traces on the
  server span per OpenTelemetry RPC semantic conventions.
"""

from __future__ import annotations

import asyncio
import inspect
from collections import defaultdict
from collections.abc import Awaitable, Callable, Iterable
from typing import TYPE_CHECKING, Any, Final, TypeAlias
from urllib.parse import unquote

import grpc
from grpc.aio import RpcContext, Server, ServerInterceptor
from grpc_interceptor import AsyncServerInterceptor
from opentelemetry import context as otel_context
from opentelemetry.propagators.textmap import Getter
from opentelemetry.proto.collector.trace.v1 import trace_service_pb2
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
    ExportTraceServiceResponse,
)
from opentelemetry.proto.collector.trace.v1.trace_service_pb2_grpc import (
    TraceServiceServicer,
    add_TraceServiceServicer_to_server,
)
from opentelemetry.semconv._incubating.attributes.rpc_attributes import (
    RPC_METHOD,
    RPC_METHOD_ORIGINAL,
    RPC_RESPONSE_STATUS_CODE,
    RPC_SYSTEM_NAME,
)
from opentelemetry.semconv.attributes.error_attributes import ERROR_TYPE
from opentelemetry.semconv.attributes.network_attributes import (
    NETWORK_PEER_ADDRESS,
    NETWORK_PEER_PORT,
)
from opentelemetry.trace import Span as OtelSpan
from opentelemetry.trace import SpanKind, Status, StatusCode
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from starlette.concurrency import run_in_threadpool
from typing_extensions import override

from phoenix.auth import CanReadToken
from phoenix.config import (
    TLSConfigVerifyClient,
    get_env_tls_config,
    get_env_tls_enabled_for_grpc,
)
from phoenix.server.bearer_auth import ApiKeyInterceptor
from phoenix.server.telemetry import (
    SCHEMA_URL,
    bind_server_span,
    is_otel_instrumentation_suppressed,
    record_span_exception,
    report_instrumentation_failure,
)
from phoenix.trace.otel import decode_otlp_span
from phoenix.trace.schemas import Span
from phoenix.utilities.project import get_project_name
from phoenix.version import __version__ as phoenix_version

if TYPE_CHECKING:
    from opentelemetry.trace import TracerProvider

ProjectName: TypeAlias = str

_RPC_OTHER_METHOD: Final[str] = "_OTHER"
_MAX_RPC_METHOD_ORIGINAL_LENGTH: Final[int] = 255
_TRACE_CONTEXT_PROPAGATOR: Final[TraceContextTextMapPropagator] = TraceContextTextMapPropagator()

_KNOWN_GRPC_METHODS: Final[frozenset[str]] = frozenset(
    f"{service.full_name}/{method.name}"
    for service in trace_service_pb2.DESCRIPTOR.services_by_name.values()
    for method in service.methods
)

# Server-error status codes per the OpenTelemetry RPC semantic conventions for gRPC.
_GRPC_SERVER_ERROR_CODES: Final[frozenset[grpc.StatusCode]] = frozenset(
    {
        grpc.StatusCode.UNKNOWN,
        grpc.StatusCode.DEADLINE_EXCEEDED,
        grpc.StatusCode.UNIMPLEMENTED,
        grpc.StatusCode.INTERNAL,
        grpc.StatusCode.UNAVAILABLE,
        grpc.StatusCode.DATA_LOSS,
    }
)


def _network_peer_dict(address: str, port_str: str) -> dict[str, str | int]:
    if not address:
        return {}
    attrs: dict[str, str | int] = {NETWORK_PEER_ADDRESS: address}
    if port_str:
        attrs[NETWORK_PEER_PORT] = int(port_str)
    return attrs


def _is_port(value: str) -> bool:
    return value.isascii() and value.isdecimal() and int(value) <= 65535


def _peer_attributes(peer: str | None) -> dict[str, str | int]:
    if not peer:
        return {}
    first_peer = peer.split(",", 1)[0]
    if first_peer.startswith("unix:"):
        socket_path = unquote(first_peer.removeprefix("unix:"))
        return {NETWORK_PEER_ADDRESS: socket_path} if socket_path else {}
    if first_peer.startswith("ipv6:"):
        # gRPC C-core URI-encodes IPv6 brackets (e.g. ``ipv6:%5B::1%5D:49994``).
        endpoint = unquote(first_peer.removeprefix("ipv6:"))
        if endpoint.startswith("["):
            bracket_end = endpoint.find("]")
            if bracket_end <= 1:
                return {}
            address = endpoint[1:bracket_end]
            remainder = endpoint[bracket_end + 1 :]
            if not remainder:
                return _network_peer_dict(address, "")
            if remainder.startswith(":") and _is_port(remainder[1:]):
                return _network_peer_dict(address, remainder[1:])
            return {}
        return _network_peer_dict(endpoint, "")
    if first_peer.startswith("ipv4:"):
        endpoint = unquote(first_peer.removeprefix("ipv4:"))
        host, separator, port_str = endpoint.rpartition(":")
        if separator:
            if not _is_port(port_str):
                return {}
            return _network_peer_dict(host, port_str)
        return _network_peer_dict(endpoint, "")
    return {}


def _record_grpc_status(
    span: OtelSpan,
    status_code: grpc.StatusCode,
    raw_details: str | bytes | None,
) -> None:
    try:
        if not span.is_recording():
            return
        span.set_attribute(RPC_RESPONSE_STATUS_CODE, status_code.name)
        if status_code in _GRPC_SERVER_ERROR_CODES:
            span.set_attribute(ERROR_TYPE, status_code.name)
            details = (
                raw_details.decode("utf-8", errors="replace")
                if isinstance(raw_details, bytes)
                else (raw_details or "")
            )
            description = f"{status_code.name}: {details}" if details else status_code.name
            span.set_status(Status(StatusCode.ERROR, description))
    except Exception:
        report_instrumentation_failure("_record_grpc_status")


class _GrpcMetadataGetter(Getter[dict[str, list[str]]]):
    def get(self, carrier: dict[str, list[str]], key: str) -> list[str] | None:
        return carrier.get(key.lower()) or None

    def keys(self, carrier: dict[str, list[str]]) -> list[str]:
        return list(carrier.keys())


_GRPC_METADATA_GETTER = _GrpcMetadataGetter()


def _extract_parent_context(
    metadata: Iterable[tuple[str, str | bytes]] | None,
) -> otel_context.Context:
    carrier: dict[str, list[str]] = defaultdict(list)
    for item in metadata or ():
        key, value = item[0], item[1]
        if isinstance(value, str):
            carrier[key.lower()].append(value)
    return _TRACE_CONTEXT_PROPAGATOR.extract(
        carrier,
        context=otel_context.Context(),
        getter=_GRPC_METADATA_GETTER,
    )


class TracingServerInterceptor(AsyncServerInterceptor):
    """Trace inbound unary gRPC calls using OpenTelemetry RPC semantic conventions."""

    def __init__(
        self,
        tracer_provider: TracerProvider,
        *,
        known_methods: frozenset[str] = _KNOWN_GRPC_METHODS,
    ) -> None:
        self._tracer_provider = tracer_provider
        self._known_methods = known_methods
        self._tracer = tracer_provider.get_tracer(
            "phoenix.server.grpc",
            phoenix_version,
            schema_url=SCHEMA_URL,
        )

    def _prepare_rpc_span(
        self,
        method_name: str,
        metadata: Iterable[tuple[str, str | bytes]] | None,
        peer: str | None = None,
    ) -> tuple[str, otel_context.Context, dict[str, str | int]]:
        parent_context = _extract_parent_context(metadata)
        normalized_method = method_name.lstrip("/")
        if normalized_method in self._known_methods:
            rpc_method = normalized_method
            span_name = normalized_method
        else:
            rpc_method = _RPC_OTHER_METHOD
            span_name = "grpc"
        attributes: dict[str, str | int] = {
            RPC_SYSTEM_NAME: "grpc",
            RPC_METHOD: rpc_method,
        }
        if rpc_method == _RPC_OTHER_METHOD and normalized_method:
            attributes[RPC_METHOD_ORIGINAL] = normalized_method[:_MAX_RPC_METHOD_ORIGINAL_LENGTH]
        if peer is not None:
            attributes.update(_peer_attributes(peer))
        return span_name, parent_context, attributes

    @override
    async def intercept_service(
        self,
        continuation: Callable[[grpc.HandlerCallDetails], Awaitable[Any]],
        handler_call_details: grpc.HandlerCallDetails,
    ) -> Any:
        next_handler = await continuation(handler_call_details)
        if next_handler is None:
            if not is_otel_instrumentation_suppressed():
                try:
                    # ``grpc.HandlerCallDetails`` exposes only ``method`` and
                    # ``invocation_metadata``.
                    span_name, parent_context, attributes = self._prepare_rpc_span(
                        handler_call_details.method or "",
                        handler_call_details.invocation_metadata,
                    )
                    span = self._tracer.start_span(
                        span_name,
                        context=parent_context,
                        kind=SpanKind.SERVER,
                        attributes=attributes,
                    )
                    _record_grpc_status(span, grpc.StatusCode.UNIMPLEMENTED, None)
                    span.end()
                except Exception:
                    report_instrumentation_failure("TracingServerInterceptor.intercept_service")
            return None

        async def _resolved_continuation(_: grpc.HandlerCallDetails) -> Any:
            return next_handler

        return await super().intercept_service(  # type: ignore[no-untyped-call,unused-ignore]
            _resolved_continuation, handler_call_details
        )

    @override
    async def intercept(
        self,
        method: Callable[[Any, grpc.aio.ServicerContext], Awaitable[Any]],
        request_or_iterator: Any,
        context: grpc.aio.ServicerContext,
        method_name: str,
    ) -> Any:
        if is_otel_instrumentation_suppressed():
            return await method(request_or_iterator, context)
        try:
            span_name, parent_context, attributes = self._prepare_rpc_span(
                method_name,
                context.invocation_metadata(),
                peer=context.peer(),
            )
        except Exception:
            report_instrumentation_failure("TracingServerInterceptor.intercept")
            return await method(request_or_iterator, context)
        with (
            self._tracer.start_as_current_span(
                span_name,
                context=parent_context,
                kind=SpanKind.SERVER,
                attributes=attributes,
                record_exception=False,
                set_status_on_exception=False,
            ) as span,
            bind_server_span(span, self._tracer_provider),
        ):
            try:
                call_result = method(request_or_iterator, context)
                if inspect.isasyncgen(call_result):
                    raise TypeError("TracingServerInterceptor only supports unary RPC responses")
                response = await call_result
            except grpc.aio.AbortError:
                _record_grpc_status(
                    span,
                    context.code() or grpc.StatusCode.UNKNOWN,
                    context.details(),
                )
                raise
            except asyncio.CancelledError:
                remaining = context.time_remaining()
                cancel_status = (
                    grpc.StatusCode.DEADLINE_EXCEEDED
                    if isinstance(remaining, (int, float)) and remaining <= 0
                    else grpc.StatusCode.CANCELLED
                )
                _record_grpc_status(span, cancel_status, None)
                raise
            except Exception as exception:
                raw_code = context.code()
                status_code = (
                    grpc.StatusCode.UNKNOWN if raw_code in (None, grpc.StatusCode.OK) else raw_code
                )
                if span.is_recording():
                    span.set_attribute(RPC_RESPONSE_STATUS_CODE, status_code.name)
                    record_span_exception(span, exception)
                raise
            _record_grpc_status(
                span,
                context.code() or grpc.StatusCode.OK,
                context.details(),
            )
            return response


class Servicer(TraceServiceServicer):  # type: ignore[misc,unused-ignore]
    def __init__(
        self,
        enqueue_span: Callable[[Span, ProjectName], Awaitable[None]],
    ) -> None:
        super().__init__()
        self._enqueue_span = enqueue_span

    async def Export(
        self,
        request: ExportTraceServiceRequest,
        context: RpcContext,
    ) -> ExportTraceServiceResponse:
        for resource_spans in request.resource_spans:
            project_name = get_project_name(resource_spans.resource.attributes)
            for scope_span in resource_spans.scope_spans:
                for otlp_span in scope_span.spans:
                    span = await run_in_threadpool(decode_otlp_span, otlp_span)
                    await self._enqueue_span(span, project_name)
        return ExportTraceServiceResponse()


class GrpcServer:
    def __init__(
        self,
        enqueue_span: Callable[[Span, ProjectName], Awaitable[None]],
        port: int,
        host: str,
        tracer_provider: TracerProvider | None = None,
        enable_prometheus: bool = False,
        disabled: bool = False,
        token_store: CanReadToken | None = None,
        interceptors: Iterable[ServerInterceptor] = (),
    ) -> None:
        self._enqueue_span = enqueue_span
        self._server: Server | None = None
        self._bound_port: int | None = None
        self._tracer_provider = tracer_provider
        self._enable_prometheus = enable_prometheus
        self._disabled = disabled
        self._port = port
        self._bind_address = _bind_address(host, port)
        self._token_store = token_store
        self._interceptors = list(interceptors)

    @property
    def bound_port(self) -> int | None:
        """The TCP port bound by the running gRPC server, or ``None`` when stopped."""
        return self._bound_port

    async def __aenter__(self) -> None:
        if self._disabled:
            return
        interceptors = list(self._interceptors)
        if self._token_store:
            interceptors.append(ApiKeyInterceptor(self._token_store))
        if self._enable_prometheus:
            ...
            # TODO: convert to async interceptor
            # from py_grpc_prometheus.prometheus_server_interceptor import PromServerInterceptor
            #
            # interceptors.append(PromServerInterceptor())
        if self._tracer_provider is not None:
            interceptors.insert(0, TracingServerInterceptor(self._tracer_provider))
        server = grpc.aio.server(
            options=(("grpc.so_reuseport", 0),),
            interceptors=interceptors,
        )
        if get_env_tls_enabled_for_grpc():
            assert (tls_config := get_env_tls_config())
            private_key_certificate_chain_pairs = [(tls_config.key_data, tls_config.cert_data)]
            server_credentials = (
                grpc.ssl_server_credentials(
                    private_key_certificate_chain_pairs,
                    root_certificates=tls_config.ca_data,
                    require_client_auth=True,
                )
                if isinstance(tls_config, TLSConfigVerifyClient)
                else grpc.ssl_server_credentials(private_key_certificate_chain_pairs)
            )
            self._bound_port = server.add_secure_port(self._bind_address, server_credentials)
        else:
            self._bound_port = server.add_insecure_port(self._bind_address)
        add_TraceServiceServicer_to_server(Servicer(self._enqueue_span), server)  # type: ignore[no-untyped-call,unused-ignore]
        await server.start()
        self._server = server

    async def __aexit__(self, *args: Any, **kwargs: Any) -> None:
        if self._server is None:
            return
        await self._server.stop(5)
        self._server = None
        self._bound_port = None


def _bind_address(host: str, port: int) -> str:
    """Format a gRPC bind address for a host from ``canonicalize_host``."""
    if ":" in host:
        return f"[{host}]:{port}"
    return f"{host}:{port}"
