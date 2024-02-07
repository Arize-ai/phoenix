from concurrent import futures
from typing import Protocol

import grpc  # type: ignore
from grpc import RpcContext
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
    ExportTraceServiceResponse,
)
from opentelemetry.proto.collector.trace.v1.trace_service_pb2_grpc import (
    TraceServiceServicer,
    add_TraceServiceServicer_to_server,
)
from opentelemetry.proto.trace.v1.trace_pb2 import Span


class SupportsPutSpan(Protocol):
    def put(self, span: Span) -> None:
        ...


class Servicer(TraceServiceServicer):
    def __init__(self, queue: SupportsPutSpan) -> None:
        super().__init__()
        self._queue = queue

    def Export(
        self, request: ExportTraceServiceRequest, context: RpcContext
    ) -> ExportTraceServiceResponse:
        for resource_spans in request.resource_spans:
            for scope_span in resource_spans.scope_spans:
                for span in scope_span.spans:
                    self._queue.put(span)
        return ExportTraceServiceResponse()


def serve(queue: SupportsPutSpan) -> None:
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    add_TraceServiceServicer_to_server(Servicer(queue), server)  # type: ignore
    server.add_insecure_port("[::]:4317")
    server.start()
    server.wait_for_termination()
