import json
from datetime import datetime
from typing import Any, Dict, Iterator, Optional

from langchain.callbacks.tracers.base import BaseTracer
from langchain.callbacks.tracers.schemas import Run

from phoenix.trace.schemas import Span, SpanKind, SpanStatusCode
from phoenix.trace.semantic_conventions import (
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    MimeType,
)
from phoenix.trace.tracer import Tracer


def _langchain_run_type_to_span_kind(run_type: str) -> SpanKind:
    # TODO: LangChain is moving away from enums and to arbitrary strings
    # for the run_type variable, so we may need to do the same
    return SpanKind(run_type.upper())


def _serialize_json(obj: Any) -> str:
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)


def _convert_io(obj: Optional[Dict[str, Any]]) -> Iterator[Any]:
    if obj is None:
        return
    if not isinstance(obj, dict):
        raise ValueError(f"obj should be dict, but obj={obj}")
    if len(obj) == 1 and isinstance(value := next(iter(obj.values())), str):
        yield value
    else:
        yield json.dumps(obj, default=_serialize_json)
        yield MimeType.JSON


class OpenInferenceTracer(Tracer, BaseTracer):
    def _convert_run_to_spans(
        self,
        run: Dict[str, Any],
        parent: Optional[Span] = None,
    ) -> None:
        attributes: Dict[str, Any] = {}
        for io_key, io_attributes in {
            "inputs": (INPUT_VALUE, INPUT_MIME_TYPE),
            "outputs": (OUTPUT_VALUE, OUTPUT_MIME_TYPE),
        }.items():
            attributes.update(zip(io_attributes, _convert_io(run.get(io_key))))
        span = self.create_span(
            name=run["name"],
            span_kind=_langchain_run_type_to_span_kind(run["run_type"]),
            parent_id=None if parent is None else parent.context.span_id,
            trace_id=None if parent is None else parent.context.trace_id,
            start_time=run["start_time"],
            end_time=run["end_time"],
            # TODO: understand the error scenarios in LangChain
            # and add unit tests for them
            status_code=SpanStatusCode.OK,
            attributes=attributes,
        )
        for child_run in run["child_runs"]:
            self._convert_run_to_spans(child_run, span)

    def _persist_run(self, run: Run) -> None:
        # Note that this relies on `.dict()` from pydantic for the
        # serialization of objects like `langchain.schema.Document`.
        self._convert_run_to_spans(run.dict())
