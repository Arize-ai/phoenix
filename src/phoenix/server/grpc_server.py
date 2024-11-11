from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING, Any, Optional

import grpc
from grpc.aio import RpcContext, Server, ServerInterceptor
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
    ExportTraceServiceResponse,
)
from opentelemetry.proto.collector.trace.v1.trace_service_pb2_grpc import (
    TraceServiceServicer,
    add_TraceServiceServicer_to_server,
)
from typing_extensions import TypeAlias

from phoenix.auth import CanReadToken
from phoenix.config import get_env_grpc_port
from phoenix.server.bearer_auth import ApiKeyInterceptor
from phoenix.trace.otel import decode_otlp_span
from phoenix.trace.schemas import Span
from phoenix.utilities.project import get_project_name

if TYPE_CHECKING:
    from opentelemetry.trace import TracerProvider

ProjectName: TypeAlias = str


class Servicer(TraceServiceServicer):  # type: ignore[misc,unused-ignore]
    def __init__(
        self,
        callback: Callable[[Span, ProjectName], Awaitable[None]],
    ) -> None:
        super().__init__()
        self._callback = callback

    async def Export(
        self,
        request: ExportTraceServiceRequest,
        context: RpcContext,
    ) -> ExportTraceServiceResponse:
        for resource_spans in request.resource_spans:
            project_name = get_project_name(resource_spans.resource.attributes)
            for scope_span in resource_spans.scope_spans:
                for otlp_span in scope_span.spans:
                    span = decode_otlp_span(otlp_span)
                    await self._callback(span, project_name)
        return ExportTraceServiceResponse()


class GrpcServer:
    def __init__(
        self,
        callback: Callable[[Span, ProjectName], Awaitable[None]],
        tracer_provider: Optional["TracerProvider"] = None,
        enable_prometheus: bool = False,
        disabled: bool = False,
        token_store: Optional[CanReadToken] = None,
        interceptors: list[ServerInterceptor] = [],
    ) -> None:
        self._callback = callback
        self._server: Optional[Server] = None
        self._tracer_provider = tracer_provider
        self._enable_prometheus = enable_prometheus
        self._disabled = disabled
        self._token_store = token_store
        self._interceptors = interceptors

    async def __aenter__(self) -> None:
        interceptors = self._interceptors
        if self._disabled:
            return
        if self._token_store:
            interceptors.append(ApiKeyInterceptor(self._token_store))
        if self._enable_prometheus:
            ...
            # TODO: convert to async interceptor
            # from py_grpc_prometheus.prometheus_server_interceptor import PromServerInterceptor
            #
            # interceptors.append(PromServerInterceptor())
        if self._tracer_provider is not None:
            from opentelemetry.instrumentation.grpc import GrpcAioInstrumentorServer

            GrpcAioInstrumentorServer().instrument(tracer_provider=self._tracer_provider)  # type: ignore
        server = grpc.aio.server(
            options=(("grpc.so_reuseport", 0),),
            interceptors=interceptors,
        )
        server.add_insecure_port(f"[::]:{get_env_grpc_port()}")
        add_TraceServiceServicer_to_server(Servicer(self._callback), server)  # type: ignore[no-untyped-call,unused-ignore]
        await server.start()
        self._server = server

    async def __aexit__(self, *args: Any, **kwargs: Any) -> None:
        if self._server is None:
            return
        await self._server.stop(5)
        self._server = None
        if self._tracer_provider is not None:
            from opentelemetry.instrumentation.grpc import GrpcAioInstrumentorServer

            GrpcAioInstrumentorServer().uninstrument()  # type: ignore
