import json
from datetime import datetime
from typing import Any, Dict, Iterator, List, Optional, Tuple

from langchain.callbacks.tracers.base import BaseTracer
from langchain.callbacks.tracers.schemas import Run

from phoenix.trace.schemas import Span, SpanEvent, SpanException, SpanKind, SpanStatusCode
from phoenix.trace.semantic_conventions import (
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    LLM_PROMPT_TEMPLATE,
    LLM_PROMPT_TEMPLATE_VARIABLES,
    LLM_PROMPT_TEMPLATE_VERSION,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    MimeType,
)
from phoenix.trace.tracer import Tracer


def _langchain_run_type_to_span_kind(run_type: str) -> SpanKind:
    # TODO: LangChain is moving away from enums and to arbitrary strings
    # for the run_type variable, so we may need to do the same
    try:
        return SpanKind(run_type.upper())
    except ValueError:
        return SpanKind.UNKNOWN


def _serialize_json(obj: Any) -> str:
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)


def _convert_io(obj: Optional[Dict[str, Any]]) -> Iterator[Any]:
    if not obj:
        return
    if not isinstance(obj, dict):
        raise ValueError(f"obj should be dict, but obj={obj}")
    if len(obj) == 1 and isinstance(value := next(iter(obj.values())), str):
        yield value
    else:
        yield json.dumps(obj, default=_serialize_json)
        yield MimeType.JSON


def _prompt_template(serialized: Dict[str, Any]) -> Iterator[Tuple[str, Any]]:
    """
    A best-effort attempt to locate the PromptTemplate object among the
    keyword arguments of a serialized object, e.g. an LLMChain object.
    """
    for obj in filter(
        # The `id` field of the object is a list indicating the path to the
        # object's class in the LangChain package, e.g. `PromptTemplate` in
        # the `langchain.prompts.prompt` module is represented as
        # ["langchain", "prompts", "prompt", "PromptTemplate"]
        lambda x: x["id"][-1].endswith("PromptTemplate"),
        serialized.get("kwargs", {}).values(),
    ):
        kwargs = obj.get("kwargs", {})
        if not (template := kwargs.get("template", "")):
            continue
        yield LLM_PROMPT_TEMPLATE, template
        yield LLM_PROMPT_TEMPLATE_VARIABLES, kwargs.get("input_variables", [])
        yield LLM_PROMPT_TEMPLATE_VERSION, "unknown"
        break


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
        attributes.update(_prompt_template(run["serialized"]))
        events: List[SpanEvent] = []
        if (error := run["error"]) is None:
            status_code = SpanStatusCode.OK
        else:
            status_code = SpanStatusCode.ERROR
            events.extend(
                SpanException(
                    message=error,
                    timestamp=error_event["time"],
                )
                for error_event in filter(
                    lambda event: event["name"] == "error",
                    run["events"],
                )
            )
        span = self.create_span(
            name=run["name"],
            span_kind=_langchain_run_type_to_span_kind(run["run_type"]),
            parent_id=None if parent is None else parent.context.span_id,
            trace_id=None if parent is None else parent.context.trace_id,
            start_time=run["start_time"],
            end_time=run["end_time"],
            status_code=status_code,
            attributes=attributes,
            events=events,
        )
        for child_run in run["child_runs"]:
            self._convert_run_to_spans(child_run, span)

    def _persist_run(self, run: Run) -> None:
        # Note that this relies on `.dict()` from pydantic for the
        # serialization of objects like `langchain.schema.Document`.
        self._convert_run_to_spans(run.dict())
