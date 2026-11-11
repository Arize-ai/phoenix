import asyncio
from typing import TYPE_CHECKING, Any, Awaitable, Callable, Final, Iterable, Optional

import grpc
from grpc.aio import RpcContext, Server, ServerInterceptor
from grpc_interceptor import AsyncServerInterceptor
from opentelemetry import context as otel_context
from opentelemetry.context import _SUPPRESS_INSTRUMENTATION_KEY
from opentelemetry.propagate import extract
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
    ExportTraceServiceResponse,
)
from opentelemetry.proto.collector.trace.v1.trace_service_pb2_grpc import (
    TraceServiceServicer,
    add_TraceServiceServicer_to_server,
)
from opentelemetry.trace import Span as OtelSpan
from opentelemetry.trace import SpanKind, Status, StatusCode
from starlette.concurrency import run_in_threadpool
from typing_extensions import TypeAlias, override

from phoenix.auth import CanReadToken
from phoenix.config import (
    TLSConfigVerifyClient,
    get_env_tls_config,
    get_env_tls_enabled_for_grpc,
)
from phoenix.server.bearer_auth import ApiKeyInterceptor
from phoenix.trace.otel import decode_otlp_span
from phoenix.trace.schemas import Span
from phoenix.utilities.project import get_project_name
from phoenix.version import __version__ as phoenix_version

if TYPE_CHECKING:
    from opentelemetry.trace import TracerProvider

ProjectName: TypeAlias = str

_RPC_SYSTEM: Final[str] = "rpc.system"
_RPC_SERVICE: Final[str] = "rpc.service"
_RPC_METHOD: Final[str] = "rpc.method"
_RPC_GRPC_STATUS_CODE: Final[str] = "rpc.grpc.status_code"

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


def _record_grpc_status(
    span: OtelSpan,
    status_code: grpc.StatusCode,
    raw_details: str | bytes | None,
) -> None:
    if not span.is_recording():
        return
    span.set_attribute(_RPC_GRPC_STATUS_CODE, status_code.value[0])
    if status_code in _GRPC_SERVER_ERROR_CODES:
        details = (
            raw_details.decode("utf-8", errors="replace")
            if isinstance(raw_details, bytes)
            else (raw_details or "")
        )
        description = f"{status_code}: {details}" if details else str(status_code)
        span.set_status(Status(StatusCode.ERROR, description))


class TracingServerInterceptor(AsyncServerInterceptor):
    """Trace inbound unary gRPC calls with the server-owned provider."""

    def __init__(self, tracer_provider: "TracerProvider") -> None:
        self._tracer = tracer_provider.get_tracer("phoenix.server.grpc", phoenix_version)

    @override
    async def intercept(
        self,
        method: Callable[[Any, grpc.aio.ServicerContext], Awaitable[Any]],
        request_or_iterator: Any,
        context: grpc.aio.ServicerContext,
        method_name: str,
    ) -> Any:
        if bool(otel_context.get_value(_SUPPRESS_INSTRUMENTATION_KEY)):
            return await method(request_or_iterator, context)
        carrier = {
            key.lower(): value
            for key, value in (context.invocation_metadata() or ())
            if isinstance(value, str)
        }
        token = otel_context.attach(extract(carrier))
        attributes: dict[str, str | int] = {_RPC_SYSTEM: "grpc"}
        service, separator, rpc_method = method_name.lstrip("/").partition("/")
        if separator:
            attributes[_RPC_SERVICE] = service
            attributes[_RPC_METHOD] = rpc_method
        try:
            with self._tracer.start_as_current_span(
                method_name,
                kind=SpanKind.SERVER,
                attributes=attributes,
                record_exception=False,
                set_status_on_exception=False,
            ) as span:
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
                        span.set_attribute(
                            _RPC_GRPC_STATUS_CODE,
                            grpc.StatusCode.CANCELLED.value[0],
                        )
                    raise
                except Exception as exception:
                    status_code = context.code() or grpc.StatusCode.UNKNOWN
                    if span.is_recording():
                        span.record_exception(exception)
                        span.set_attribute(_RPC_GRPC_STATUS_CODE, status_code.value[0])
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
        tracer_provider: Optional["TracerProvider"] = None,
        enable_prometheus: bool = False,
        disabled: bool = False,
        token_store: Optional[CanReadToken] = None,
        interceptors: Iterable[ServerInterceptor] = (),
    ) -> None:
        self._enqueue_span = enqueue_span
        self._server: Optional[Server] = None
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
