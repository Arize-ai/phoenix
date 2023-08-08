from typing import List
from uuid import uuid4

from langchain.callbacks.tracers.base import BaseTracer
from langchain.callbacks.tracers.schemas import Run

from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode


class OpenInferenceTracer(BaseTracer):  # type: ignore
    def __init__(self) -> None:
        self.spans: List[Span] = []
        self.trace_id = uuid4()
        super().__init__()

    def _persist_run(self, run: Run) -> None:
        if run.parent_run_id is None:
            self.trace_id = uuid4()
        span = Span(
            name=run.name,
            span_kind=SpanKind(run.run_type.upper()),
            parent_id=run.parent_run_id,
            context=SpanContext(
                span_id=run.id,
                trace_id=self.trace_id,
            ),
            start_time=run.start_time,
            end_time=run.end_time,
            status_code=SpanStatusCode.OK,
            events=[],
            attributes={},
            status_message="",
            conversation=None,
        )
        self.spans.append(span)
        for run in run.child_runs:
            self._persist_run(run)
