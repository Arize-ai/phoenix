import weakref
from collections import defaultdict
from datetime import datetime
from queue import SimpleQueue
from threading import RLock, Thread
from types import MethodType
from typing import DefaultDict, Iterable, Iterator, Optional, Tuple

from opentelemetry.proto.trace.v1 import trace_pb2 as otlp

from phoenix.core.project import (
    _DEFAULT_PROJECT_NAME,
    END_OF_QUEUE,
    Project,
    ReadableSpan,
    _ProjectName,
    _SpanItem,
)
from phoenix.trace.schemas import Span, SpanID, TraceID


class Traces:
    def __init__(self) -> None:
        self._span_queue: "SimpleQueue[Optional[_SpanItem]]" = SimpleQueue()
        # Putting `None` as the sentinel value for queue termination.
        weakref.finalize(self, self._span_queue.put, END_OF_QUEUE)
        self._lock = RLock()
        self._projects: DefaultDict[_ProjectName, "Project"] = defaultdict(
            Project,
            {_DEFAULT_PROJECT_NAME: Project()},
        )
        self._start_consumers()

    def get_projects(self) -> Iterator[Tuple[str, "Project"]]:
        with self._lock:
            projects = tuple(self._projects.items())
        yield from projects

    def get_trace(self, trace_id: TraceID) -> Iterator[Span]:
        with self._lock:
            if not (project := self._projects.get(_DEFAULT_PROJECT_NAME)):
                return
        yield from project.get_trace(trace_id)

    def get_spans(
        self,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
        root_spans_only: Optional[bool] = False,
        span_ids: Optional[Iterable[SpanID]] = None,
    ) -> Iterator[Span]:
        with self._lock:
            if not (project := self._projects.get(_DEFAULT_PROJECT_NAME)):
                return
        yield from project.get_spans(start_time, stop_time, root_spans_only, span_ids)

    def get_num_documents(self, span_id: SpanID) -> int:
        with self._lock:
            if not (project := self._projects.get(_DEFAULT_PROJECT_NAME)):
                return 0
        return project.get_num_documents(span_id)

    def root_span_latency_ms_quantiles(self, *probabilities: float) -> Iterator[Optional[float]]:
        """Root span latency quantiles in milliseconds"""
        with self._lock:
            if not (project := self._projects.get(_DEFAULT_PROJECT_NAME)):
                for _ in probabilities:
                    yield None
                return
        for probability in probabilities:
            yield project.root_span_latency_ms_quantiles(probability)

    def get_descendant_spans(self, span_id: SpanID) -> Iterator[Span]:
        with self._lock:
            if not (project := self._projects.get(_DEFAULT_PROJECT_NAME)):
                return
        yield from project.get_descendant_spans(span_id)

    @property
    def last_updated_at(self) -> Optional[datetime]:
        with self._lock:
            if not (project := self._projects.get(_DEFAULT_PROJECT_NAME)):
                return None
        return project.last_updated_at

    @property
    def span_count(self) -> int:
        """Total number of spans"""
        project_name = _DEFAULT_PROJECT_NAME
        with self._lock:
            if not (project := self._projects.get(project_name)):
                return 0
        return project.span_count

    @property
    def token_count_total(self) -> int:
        with self._lock:
            if not (project := self._projects.get(_DEFAULT_PROJECT_NAME)):
                return 0
        return project.token_count_total

    @property
    def right_open_time_range(self) -> Tuple[Optional[datetime], Optional[datetime]]:
        with self._lock:
            if not (project := self._projects.get(_DEFAULT_PROJECT_NAME)):
                return None, None
        return project.right_open_time_range

    def put(
        self,
        item: otlp.Span,
        project_name: Optional[str] = None,
    ) -> None:
        if not project_name:
            project_name = _DEFAULT_PROJECT_NAME
        self._span_queue.put((item, project_name))

    def _start_consumers(self) -> None:
        Thread(
            target=MethodType(
                self.__class__._consume_spans,
                weakref.proxy(self),
            ),
            args=(self._span_queue,),
            daemon=True,
        ).start()

    def _consume_spans(self, queue: "SimpleQueue[Optional[_SpanItem]]") -> None:
        while (item := queue.get()) is not END_OF_QUEUE:
            otlp_span, project_name = item
            span = ReadableSpan(otlp_span)
            with self._lock:
                project = self._projects[project_name]
            project.add_span(span)
