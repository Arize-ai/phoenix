from base64 import urlsafe_b64decode, urlsafe_b64encode
from pathlib import Path
from queue import SimpleQueue
from threading import RLock, Thread
from typing import Iterator, Optional, Tuple

from opentelemetry.proto.trace.v1.trace_pb2 import TracesData
from typing_extensions import TypeAlias

from phoenix.utilities.project import get_project_name

_Queue: TypeAlias = "SimpleQueue[Optional[TracesData]]"

_END_OF_QUEUE = None
_DIR_PREFIX = "project."


class FileSpanStoreImpl:
    def __init__(self, root: Path) -> None:
        root.mkdir(exist_ok=True, parents=True)
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
        Thread(target=self._load_spans_from_projects, args=(queue,)).start()
        while (item := queue.get()) is not _END_OF_QUEUE:
            yield item

    def _load_spans_from_projects(self, queue: _Queue) -> None:
        """Load spans from all projects into the queue"""
        for project in self._projects.values():
            project.load(queue)
        queue.put(_END_OF_QUEUE)


class _Project:
    def __init__(self, name: str, root: Path) -> None:
        self._path = root / f"project.{_b64encode(name.encode())}"
        self._path.mkdir(parents=True, exist_ok=True)
        self._spans_path = self._path / "spans"
        self._spans_path.mkdir(parents=True, exist_ok=True)
        self._spans = [_Spans(file_path) for file_path in self._spans_path.glob("*.txt")]
        if not self._spans:
            self._spans.append(_Spans(self._spans_path / "spans.txt"))

    def save(self, traces_data: TracesData) -> None:
        self._spans[-1].save(traces_data)

    def load(self, queue: _Queue) -> None:
        for spans in self._spans:
            spans.load(queue)


class _Spans:
    def __init__(self, file_path: Path):
        self._lock = RLock()
        self._path = file_path
        self._path.touch(exist_ok=True)

    def save(self, traces_data: TracesData) -> None:
        with self._lock:
            with self._path.open("a") as f:
                f.write(_b64encode(traces_data.SerializeToString()))
                f.write("\n")

    def load(self, queue: _Queue) -> None:
        with self._lock:
            with self._path.open("r") as f:
                while line := f.readline():
                    queue.put(TracesData.FromString(_b64decode(line)))


def _load_projects(root: Path) -> Iterator[Tuple[str, _Project]]:
    for dirname in root.glob(f"{_DIR_PREFIX}*"):
        name = _b64decode(dirname.name[len(_DIR_PREFIX) :]).decode()
        yield name, _Project(name, root)


def _b64encode(s: bytes) -> str:
    return urlsafe_b64encode(s).decode()


def _b64decode(name: str) -> bytes:
    return urlsafe_b64decode(name.encode())
