import weakref
from collections import defaultdict
from queue import SimpleQueue
from threading import RLock, Thread
from types import MethodType
from typing import DefaultDict, Optional, Tuple, Union

from typing_extensions import assert_never

import phoenix.trace.v1 as pb
from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.core.project import (
    END_OF_QUEUE,
    Project,
    _ProjectName,
)
from phoenix.trace.schemas import Span

_SpanItem = Tuple[Span, _ProjectName]
_EvalItem = Tuple[pb.Evaluation, _ProjectName]


class Traces:
    def __init__(self) -> None:
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

    def get_project(self, project_name: str) -> Optional["Project"]:
        with self._lock:
            return self._projects.get(project_name)

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
            with self._lock:
                project = self._projects[project_name]
            project.add_span(span)

    def _consume_evals(self, queue: "SimpleQueue[Optional[_EvalItem]]") -> None:
        while (item := queue.get()) is not END_OF_QUEUE:
            pb_eval, project_name = item
            with self._lock:
                project = self._projects[project_name]
            project.add_eval(pb_eval)
