from base64 import urlsafe_b64decode, urlsafe_b64encode
from collections import deque
from pathlib import Path
from queue import SimpleQueue
from threading import RLock, Thread
from typing import Deque, Iterable, Iterator, Optional, Tuple

from openinference.semconv.resource import ResourceAttributes
from opentelemetry.proto.common.v1.common_pb2 import KeyValue
from opentelemetry.proto.trace.v1.trace_pb2 import TracesData
from typing_extensions import TypeAlias

_Queue: TypeAlias = "SimpleQueue[Optional[TracesData]]"

_END_OF_QUEUE = None
_FILE_PREFIX = "px.spans."


class FileSpanStoreImpl:
    def __init__(self, directory_path: Path) -> None:
        directory_path.mkdir(exist_ok=True, parents=True)
        self.directory_path = directory_path
        self.projects = dict(_load_projects(directory_path))
        self.output_queue: _Queue = SimpleQueue()

    def save(self, req: TracesData) -> None:
        for resource_spans in req.resource_spans:
            project_name = _get_project_name(resource_spans.resource.attributes)
            if project_name not in self.projects:
                self.projects[project_name] = _Project(project_name, self.directory_path)
            self.projects[project_name].save(
                TracesData(resource_spans=[resource_spans]),
            )

    def load(self) -> Iterator[TracesData]:
        Thread(target=self._load).start()
        while (item := self.output_queue.get()) is not _END_OF_QUEUE:
            yield item

    def _load(self) -> None:
        for project in self.projects.values():
            project.load(self.output_queue)
        self.output_queue.put(_END_OF_QUEUE)


class _Project:
    def __init__(self, name: str, directory_path: Path) -> None:
        self.lock = RLock()
        self.file_path = directory_path / f"{_FILE_PREFIX}{_b64encode(name.encode())}.txt"

    def save(self, req: TracesData) -> None:
        with self.lock:
            with self.file_path.open("a") as f:
                f.write(_b64encode(req.SerializeToString()) + "\n")

    def load(self, queue: _Queue, n: int = 1000) -> None:
        lines: Deque[str] = deque(maxlen=n)
        with self.lock:
            with self.file_path.open("r") as f:
                lines.extend(f)
        for line in lines:
            req = TracesData.FromString(_b64decode(line))
            queue.put(req)


def _get_project_name(attributes: Iterable[KeyValue]) -> str:
    for kv in attributes:
        if kv.key == ResourceAttributes.PROJECT_NAME and (v := kv.value.string_value):
            return v
    return "default"


def _load_projects(directory_path: Path) -> Iterator[Tuple[str, _Project]]:
    for filename in directory_path.glob(f"{_FILE_PREFIX}*.txt"):
        name = _b64decode(filename.name[len(_FILE_PREFIX) : -4]).decode()
        yield name, _Project(name, directory_path)


def _b64encode(s: bytes) -> str:
    return urlsafe_b64encode(s).decode()


def _b64decode(name: str) -> bytes:
    return urlsafe_b64decode(name.encode())
