import weakref
from collections import defaultdict
from datetime import datetime
from queue import SimpleQueue
from threading import RLock, Thread
from types import MethodType
from typing import DefaultDict, Iterator, Optional, Protocol, Tuple, Union

from typing_extensions import assert_never

import phoenix.trace.v1 as pb
from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.core.project import (
    END_OF_QUEUE,
    Project,
    WrappedSpan,
    _ProjectName,
)
from phoenix.trace.schemas import ComputedAttributes, ComputedValues, Span, TraceID

_SpanItem = Tuple[Span, _ProjectName]
_EvalItem = Tuple[pb.Evaluation, _ProjectName]


class Database(Protocol):
    def insert_span(self, span: Span, project_name: str) -> None: ...

    def trace_count(
        self,
        project_name: str,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
    ) -> int: ...

    def span_count(
        self,
        project_name: str,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
    ) -> int: ...

    def llm_token_count_total(
        self,
        project_name: str,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
    ) -> int: ...

    def get_trace(self, trace_id: TraceID) -> Iterator[Tuple[Span, ComputedValues]]: ...


class Traces:
    def __init__(self, database: Database) -> None:
        self._database = database
        self._span_queue: "SimpleQueue[Optional[_SpanItem]]" = SimpleQueue()
        self._eval_queue: "SimpleQueue[Optional[_EvalItem]]" = SimpleQueue()
        # Putting `None` as the sentinel value for queue termination.
        weakref.finalize(self, self._span_queue.put, END_OF_QUEUE)
        weakref.finalize(self, self._eval_queue.put, END_OF_QUEUE)
        self._lock = RLock()
        self._projects: DefaultDict[_ProjectName, "Project"] = defaultdict(
            Project,
            {DEFAULT_PROJECT_NAME: Project()},
        )
        self._start_consumers()

    def trace_count(
        self,
        project_name: str,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
    ) -> int:
        return self._database.trace_count(project_name, start_time, stop_time)

    def span_count(
        self,
        project_name: str,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
    ) -> int:
        return self._database.span_count(project_name, start_time, stop_time)

    def llm_token_count_total(
        self,
        project_name: str,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
    ) -> int:
        return self._database.llm_token_count_total(project_name, start_time, stop_time)

    def get_trace(self, trace_id: TraceID) -> Iterator[WrappedSpan]:
        for span, computed_values in self._database.get_trace(trace_id):
            wrapped_span = WrappedSpan(span)
            wrapped_span[ComputedAttributes.LATENCY_MS] = computed_values.latency_ms
            wrapped_span[ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_PROMPT] = (
                computed_values.cumulative_llm_token_count_prompt
            )
            wrapped_span[ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION] = (
                computed_values.cumulative_llm_token_count_completion
            )
            wrapped_span[ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_TOTAL] = (
                computed_values.cumulative_llm_token_count_total
            )
            yield wrapped_span

    def get_project(self, project_name: str) -> Optional["Project"]:
        with self._lock:
            return self._projects.get(project_name)

    def get_projects(self) -> Iterator[Tuple[int, str, "Project"]]:
        with self._lock:
            for project_id, (project_name, project) in enumerate(self._projects.items()):
                if project.is_archived:
                    continue
                yield project_id, project_name, project

    def archive_project(self, id: int) -> Optional["Project"]:
        if id == 0:
            raise ValueError("Cannot archive the default project")
        with self._lock:
            for project_id, _, project in self.get_projects():
                if id == project_id:
                    project.archive()
                    return project
        return None

    def put(
        self,
        item: Union[Span, pb.Evaluation],
        project_name: Optional[str] = None,
    ) -> None:
        if not project_name:
            project_name = DEFAULT_PROJECT_NAME
        if isinstance(item, Span):
            self._span_queue.put((item, project_name))
        elif isinstance(item, pb.Evaluation):
            self._eval_queue.put((item, project_name))
        else:
            assert_never(item)

    def _start_consumers(self) -> None:
        Thread(
            target=MethodType(self.__class__._consume_spans, weakref.proxy(self)),
            args=(self._span_queue,),
            daemon=True,
        ).start()
        Thread(
            target=MethodType(self.__class__._consume_evals, weakref.proxy(self)),
            args=(self._eval_queue,),
            daemon=True,
        ).start()

    def _consume_spans(self, queue: "SimpleQueue[Optional[_SpanItem]]") -> None:
        while (item := queue.get()) is not END_OF_QUEUE:
            span, project_name = item
            self._database.insert_span(span, project_name=project_name)
            with self._lock:
                project = self._projects[project_name]
            project.add_span(span)

    def _consume_evals(self, queue: "SimpleQueue[Optional[_EvalItem]]") -> None:
        while (item := queue.get()) is not END_OF_QUEUE:
            pb_eval, project_name = item
            with self._lock:
                project = self._projects[project_name]
            project.add_eval(pb_eval)
