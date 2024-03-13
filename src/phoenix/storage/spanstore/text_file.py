import weakref
from base64 import urlsafe_b64decode, urlsafe_b64encode
from pathlib import Path
from queue import SimpleQueue
from threading import Thread
from typing import Iterator, Optional, Tuple

from opentelemetry.proto.trace.v1.trace_pb2 import TracesData
from typing_extensions import TypeAlias

from phoenix.utilities.project import get_project_name

_Queue: TypeAlias = "SimpleQueue[Optional[TracesData]]"

_END_OF_QUEUE = None
_DIR_PREFIX = "project."


class TextFileSpanStoreImpl:
    def __init__(self, root: Path) -> None:
        self._root = root
        self._projects = dict(_load_projects(self._root))

    def save(self, traces_data: TracesData) -> None:
        for resource_spans in traces_data.resource_spans:
            project_name = get_project_name(resource_spans.resource.attributes)
            if project_name not in self._projects:
                self._projects[project_name] = _Project(project_name, self._root)
            self._projects[project_name].save(TracesData(resource_spans=[resource_spans]))

    def load(self) -> Iterator[TracesData]:
        queue: _Queue = SimpleQueue()
        Thread(target=self._load_data_from_projects, args=(queue,)).start()
        while (item := queue.get()) is not _END_OF_QUEUE:
            yield item

    def _load_data_from_projects(self, queue: _Queue) -> None:
        """Load traces data from all projects into the queue"""
        for project in self._projects.values():
            project.load(queue)
        queue.put(_END_OF_QUEUE)


class _Project:
    def __init__(self, name: str, root: Path) -> None:
        self._path = root / f"project.{_b64encode(name.encode())}"
        self._spans_path = self._path / "spans"
        self._spans_path.mkdir(parents=True, exist_ok=True)
        self._spans = _Spans(self._spans_path / "spans.txt")

    def save(self, traces_data: TracesData) -> None:
        self._spans.save(traces_data)

    def load(self, queue: _Queue) -> None:
        self._spans.load(queue)


class _Spans:
    def __init__(self, file_path: Path):
        self._path = file_path
        self._file = self._path.open("a")
        weakref.finalize(self, self._file.close)

    def save(self, traces_data: TracesData) -> None:
        self._file.write(_b64encode(traces_data.SerializeToString()))
        self._file.write("\n")

    def load(self, queue: _Queue) -> None:
        with self._path.open("r") as f:
            while line := f.readline():
                queue.put(TracesData.FromString(_b64decode(line)))


def _load_projects(root: Path) -> Iterator[Tuple[str, _Project]]:
    for dir_path in root.glob(f"{_DIR_PREFIX}*/"):
        name = _b64decode(dir_path.name[len(_DIR_PREFIX) :]).decode()
        yield name, _Project(name, root)


def _b64encode(s: bytes) -> str:
    return urlsafe_b64encode(s).decode()


def _b64decode(name: str) -> bytes:
    return urlsafe_b64decode(name.encode())
