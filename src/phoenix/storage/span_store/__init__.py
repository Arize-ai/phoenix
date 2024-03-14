from pathlib import Path
from typing import Callable, Iterator, Mapping, Protocol

from opentelemetry.proto.trace.v1.trace_pb2 import TracesData

from phoenix.config import SpanStorageType
from phoenix.storage.span_store.text_file import TextFileSpanStoreImpl


class SpanStore(Protocol):
    def save(self, req: TracesData) -> None: ...

    def load(self) -> Iterator[TracesData]: ...


SPAN_STORE_FACTORIES: Mapping[SpanStorageType, Callable[[Path], SpanStore]] = {
    SpanStorageType.TEXT_FILES: TextFileSpanStoreImpl,
}

__all__ = (
    "SpanStore",
    "SPAN_STORE_FACTORIES",
)
