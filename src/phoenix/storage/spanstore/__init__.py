from typing import Iterator, Protocol

from opentelemetry.proto.trace.v1.trace_pb2 import TracesData


class SpanStore(Protocol):
    def save(self, req: TracesData) -> None: ...

    def load(self) -> Iterator[TracesData]: ...
