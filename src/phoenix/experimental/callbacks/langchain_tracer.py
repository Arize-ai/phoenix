from typing import Optional

from langchain.callbacks.tracers.base import BaseTracer
from langchain.callbacks.tracers.schemas import Run

from phoenix.trace.schemas import Span, SpanKind, SpanStatusCode
from phoenix.trace.tracer import Tracer


def _langchain_run_type_to_span_kind(run_type: str) -> SpanKind:
    # TODO: LangChain is moving away from enums and to arbitrary strings
    # for the run_type variable, so we may need to do the same
    return SpanKind(run_type.upper())


class OpenInferenceTracer(Tracer, BaseTracer):
    def _convert_run_to_spans(
        self,
        run: Run,
        parent: Optional[Span] = None,
    ) -> None:
        span = self.create_span(
            name=run.name,
            span_kind=_langchain_run_type_to_span_kind(run.run_type),
            parent_id=None if parent is None else parent.context.span_id,
            trace_id=None if parent is None else parent.context.trace_id,
            start_time=run.start_time,
            end_time=run.end_time,
            # TODO: understand the error scenarios in LangChain
            # and add unit tests for them
            status_code=SpanStatusCode.OK,
        )
        for child_run in run.child_runs:
            self._convert_run_to_spans(child_run, span)

    def _persist_run(self, run: Run) -> None:
        self._convert_run_to_spans(run)
