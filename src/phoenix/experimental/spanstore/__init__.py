from typing import Iterator, Protocol

from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest


class SpanStore(Protocol):
    def save(self, req: ExportTraceServiceRequest) -> None: ...

    def load(self) -> Iterator[ExportTraceServiceRequest]: ...


class NoOpSpanStoreImpl:
    def save(self, req: ExportTraceServiceRequest) -> None: ...

    def load(self) -> Iterator[ExportTraceServiceRequest]:
        yield from ()
