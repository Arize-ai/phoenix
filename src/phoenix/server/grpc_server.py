from __future__ import annotations

import asyncio
from collections import defaultdict
from collections.abc import Awaitable, Callable, Iterable
from typing import TYPE_CHECKING, Any, Final, TypeAlias
from urllib.parse import unquote

import grpc
from grpc.aio import RpcContext, Server, ServerInterceptor
from grpc_interceptor import AsyncServerInterceptor
from opentelemetry import context as otel_context
from opentelemetry.propagate import extract
from opentelemetry.propagators.textmap import Getter
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
    ExportTraceServiceResponse,
)
from opentelemetry.proto.collector.trace.v1.trace_service_pb2_grpc import (
    TraceServiceServicer,
    add_TraceServiceServicer_to_server,
)
from opentelemetry.semconv.attributes.error_attributes import ERROR_TYPE
from opentelemetry.semconv.attributes.network_attributes import (
    NETWORK_PEER_ADDRESS,
    NETWORK_PEER_PORT,
)
from opentelemetry.semconv.schemas import Schemas
from opentelemetry.trace import Span as OtelSpan
from opentelemetry.trace import SpanKind, Status, StatusCode
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
    bind_server_span,
    exception_type_name,
    is_otel_instrumentation_suppressed,
)
from phoenix.trace.otel import decode_otlp_span
from phoenix.trace.schemas import Span
from phoenix.utilities.project import get_project_name
from phoenix.version import __version__ as phoenix_version

if TYPE_CHECKING:
    from opentelemetry.trace import TracerProvider

ProjectName: TypeAlias = str

# Stabilized OpenTelemetry RPC / gRPC server semantic conventions (docs/rpc/grpc.md).
_SCHEMA_URL: Final[str] = Schemas.V1_44_0.value
_RPC_SYSTEM_NAME: Final[str] = "rpc.system.name"
_RPC_METHOD: Final[str] = "rpc.method"
_RPC_METHOD_ORIGINAL: Final[str] = "rpc.method_original"
_RPC_STATUS_CODE: Final[str] = "rpc.status_code"
_RPC_OTHER_METHOD: Final[str] = "_OTHER"

_KNOWN_GRPC_METHODS: Final[frozenset[str]] = frozenset(
    {"opentelemetry.proto.collector.trace.v1.TraceService/Export"}
)

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


def _peer_attributes(peer: str | None) -> dict[str, str | int]:
    if not peer:
        return {}
    first_peer = peer.split(",", 1)[0]
    if first_peer.startswith("unix:"):
        socket_path = first_peer.removeprefix("unix:")
        return {NETWORK_PEER_ADDRESS: socket_path} if socket_path else {}
    if not first_peer.startswith(("ipv4:", "ipv6:")):
        return {}
    _, _, endpoint = first_peer.partition(":")
    host, separator, port_str = endpoint.rpartition(":")
    if not separator or not host:
        return {}
    address = unquote(host).strip("[]")
    if not address:
        return {}
    attributes: dict[str, str | int] = {NETWORK_PEER_ADDRESS: address}
    if port_str.isdigit():
        attributes[NETWORK_PEER_PORT] = int(port_str)
    return attributes


def _record_grpc_status(
    span: OtelSpan,
    status_code: grpc.StatusCode,
    raw_details: str | bytes | None,
) -> None:
    if not span.is_recording():
        return
    span.set_attribute(_RPC_STATUS_CODE, status_code.name)
    if status_code in _GRPC_SERVER_ERROR_CODES:
        span.set_attribute(ERROR_TYPE, status_code.name)
        details = (
            raw_details.decode("utf-8", errors="replace")
            if isinstance(raw_details, bytes)
            else (raw_details or "")
        )
        description = f"{status_code.name}: {details}" if details else status_code.name
        span.set_status(Status(StatusCode.ERROR, description))


class _GrpcMetadataGetter(Getter[dict[str, list[str]]]):
    def get(self, carrier: dict[str, list[str]], key: str) -> list[str] | None:
        values = carrier.get(key.lower())
        if not values:
            return None
        if key.lower() == "baggage":
            return [",".join(values)]
        return values

    def keys(self, carrier: dict[str, list[str]]) -> list[str]:
        return list(carrier.keys())


_GRPC_METADATA_GETTER = _GrpcMetadataGetter()


class TracingServerInterceptor(AsyncServerInterceptor):
    """Trace inbound unary gRPC calls using stabilized OpenTelemetry gRPC semantic conventions."""

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
            schema_url=_SCHEMA_URL,
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
        carrier: dict[str, list[str]] = defaultdict(list)
        for key, value in context.invocation_metadata() or ():
            if isinstance(value, str):
                carrier[key.lower()].append(value)
        token = otel_context.attach(extract(carrier, getter=_GRPC_METADATA_GETTER))

        normalized_method = method_name.lstrip("/")
        if normalized_method in self._known_methods:
            rpc_method = normalized_method
            span_name = normalized_method
        else:
            rpc_method = _RPC_OTHER_METHOD
            span_name = "grpc"

        attributes: dict[str, str | int] = {
            _RPC_SYSTEM_NAME: "grpc",
            _RPC_METHOD: rpc_method,
            **_peer_attributes(context.peer()),
        }
        if rpc_method == _RPC_OTHER_METHOD and normalized_method:
            attributes[_RPC_METHOD_ORIGINAL] = normalized_method

        try:
            with self._tracer.start_as_current_span(
                span_name,
                kind=SpanKind.SERVER,
                attributes=attributes,
                record_exception=False,
                set_status_on_exception=False,
            ) as span:
                with bind_server_span(span, self._tracer_provider):
                    try:
                        response = await method(request_or_iterator, context)
                    except grpc.aio.AbortError:
                        _record_grpc_status(
                            span,
                            context.code() or grpc.StatusCode.UNKNOWN,
                            context.details(),
                        )
                        raise
                    except asyncio.CancelledError:
                        if span.is_recording():
                            span.set_attribute(_RPC_STATUS_CODE, grpc.StatusCode.CANCELLED.name)
                        raise
                    except Exception as exception:
                        status_code = context.code() or grpc.StatusCode.UNKNOWN
                        if span.is_recording():
                            span.record_exception(exception)
                            span.set_attribute(_RPC_STATUS_CODE, status_code.name)
                            span.set_attribute(ERROR_TYPE, exception_type_name(exception))
                            span.set_status(Status(StatusCode.ERROR, str(exception)))
                        raise
                    _record_grpc_status(
                        span,
                        context.code() or grpc.StatusCode.OK,
                        context.details(),
                    )
                    return response
        finally:
            otel_context.detach(token)


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
        self._tracer_provider = tracer_provider
        self._enable_prometheus = enable_prometheus
        self._disabled = disabled
        self._port = port
        self._bind_address = _bind_address(host, port)
        self._token_store = token_store
        self._interceptors = list(interceptors)

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
            server.add_secure_port(self._bind_address, server_credentials)
        else:
            server.add_insecure_port(self._bind_address)
        add_TraceServiceServicer_to_server(Servicer(self._enqueue_span), server)  # type: ignore[no-untyped-call,unused-ignore]
        await server.start()
        self._server = server

    async def __aexit__(self, *args: Any, **kwargs: Any) -> None:
        if self._server is None:
            return
        await self._server.stop(5)
        self._server = None


def _bind_address(host: str, port: int) -> str:
    """Format a gRPC bind address for a host from ``canonicalize_host``."""
    if ":" in host:
        return f"[{host}]:{port}"
    return f"{host}:{port}"
