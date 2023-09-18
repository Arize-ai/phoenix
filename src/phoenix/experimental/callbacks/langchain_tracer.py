import json
import logging
from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, Iterator, List, Optional, Tuple

from langchain.callbacks.tracers.base import BaseTracer
from langchain.callbacks.tracers.schemas import Run

from phoenix.trace.exporter import HttpExporter
from phoenix.trace.schemas import (
    Span,
    SpanEvent,
    SpanException,
    SpanKind,
    SpanStatusCode,
)
from phoenix.trace.semantic_conventions import (
    DOCUMENT_CONTENT,
    DOCUMENT_METADATA,
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    LLM_FUNCTION_CALL,
    LLM_INVOCATION_PARAMETERS,
    LLM_MODEL_NAME,
    LLM_PROMPT_TEMPLATE,
    LLM_PROMPT_TEMPLATE_VARIABLES,
    LLM_PROMPT_TEMPLATE_VERSION,
    LLM_PROMPTS,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    RETRIEVAL_DOCUMENTS,
    TOOL_DESCRIPTION,
    TOOL_NAME,
    MimeType,
)
from phoenix.trace.tracer import Tracer

logger = logging.getLogger(__name__)


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


def _prompts(run_inputs: Dict[str, Any]) -> Iterator[Tuple[str, List[str]]]:
    """Yields prompts if present."""
    if "prompts" in run_inputs:
        yield LLM_PROMPTS, run_inputs["prompts"]


def _prompt_template(run_serialized: Dict[str, Any]) -> Iterator[Tuple[str, Any]]:
    """
    A best-effort attempt to locate the PromptTemplate object among the
    keyword arguments of a serialized object, e.g. an LLMChain object.
    """
    for obj in run_serialized.get("kwargs", {}).values():
        if not isinstance(obj, dict) or "id" not in obj:
            continue
        # The `id` field of the object is a list indicating the path to the
        # object's class in the LangChain package, e.g. `PromptTemplate` in
        # the `langchain.prompts.prompt` module is represented as
        # ["langchain", "prompts", "prompt", "PromptTemplate"]
        if obj["id"][-1].endswith("PromptTemplate"):
            kwargs = obj.get("kwargs", {})
            if not (template := kwargs.get("template", "")):
                continue
            yield LLM_PROMPT_TEMPLATE, template
            yield LLM_PROMPT_TEMPLATE_VARIABLES, kwargs.get("input_variables", [])
            yield LLM_PROMPT_TEMPLATE_VERSION, "unknown"
            break


def _invocation_parameters(run: Dict[str, Any]) -> Iterator[Tuple[str, str]]:
    """Yields invocation parameters if present."""
    if run["run_type"] != "llm":
        return
    run_extra = run["extra"]
    yield LLM_INVOCATION_PARAMETERS, json.dumps(run_extra.get("invocation_params", {}))


def _model_name(run_extra: Dict[str, Any]) -> Iterator[Tuple[str, str]]:
    """Yields model name if present."""
    if not (invocation_params := run_extra.get("invocation_params")):
        return
    for key in ["model_name", "model"]:
        if name := invocation_params.get(key):
            yield LLM_MODEL_NAME, name
            return


def _token_counts(run_outputs: Dict[str, Any]) -> Iterator[Tuple[str, int]]:
    """Yields token count information if present."""
    try:
        token_usage = run_outputs["llm_output"]["token_usage"]
    except Exception:
        return
    for attribute_name, key in [
        (LLM_TOKEN_COUNT_PROMPT, "prompt_tokens"),
        (LLM_TOKEN_COUNT_COMPLETION, "completion_tokens"),
        (LLM_TOKEN_COUNT_TOTAL, "total_tokens"),
    ]:
        if (token_count := token_usage.get(key)) is not None:
            yield attribute_name, token_count


def _function_calls(run_outputs: Dict[str, Any]) -> Iterator[Tuple[str, str]]:
    """Yields function call information if present."""
    try:
        function_call_data = deepcopy(
            run_outputs["generations"][0][0]["message"]["kwargs"]["additional_kwargs"][
                "function_call"
            ]
        )
        function_call_data["arguments"] = json.loads(function_call_data["arguments"])
        yield LLM_FUNCTION_CALL, json.dumps(function_call_data)
    except Exception:
        pass


def _tools(run: Dict[str, Any]) -> Iterator[Tuple[str, str]]:
    """Yields tool attributes if present."""
    if run["run_type"] != "tool":
        return
    run_serialized = run["serialized"]
    if "name" in run_serialized:
        yield TOOL_NAME, run_serialized["name"]
    if "description" in run_serialized:
        yield TOOL_DESCRIPTION, run_serialized["description"]
    # TODO: tool parameters https://github.com/Arize-ai/phoenix/issues/1330


def _retrieval_documents(
    run: Dict[str, Any],
) -> Iterator[Tuple[str, List[Any]]]:
    if run["run_type"] != "retriever":
        return
    yield RETRIEVAL_DOCUMENTS, [
        {
            DOCUMENT_CONTENT: document.get("page_content"),
            DOCUMENT_METADATA: document.get("metadata") or {},
        }
        for document in (run.get("outputs") or {}).get("documents") or []
    ]


class OpenInferenceTracer(Tracer, BaseTracer):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._exporter = self._exporter or HttpExporter()

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
        attributes.update(_prompts(run["inputs"]))
        attributes.update(_prompt_template(run["serialized"]))
        attributes.update(_invocation_parameters(run))
        attributes.update(_model_name(run["extra"]))
        attributes.update(_token_counts(run["outputs"]))
        attributes.update(_function_calls(run["outputs"]))
        attributes.update(_tools(run))
        attributes.update(_retrieval_documents(run))
        events: List[SpanEvent] = []
        if (error := run["error"]) is None:
            status_code = SpanStatusCode.OK
        else:
            status_code = SpanStatusCode.ERROR
            # Since there is only one error message, keep just the
            # first error event.
            error_event = next(
                filter(
                    lambda event: event["name"] == "error",
                    run["events"],
                )
            )
            events.append(
                SpanException(
                    message=error,
                    timestamp=error_event["time"],
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
        try:
            self._convert_run_to_spans(run.dict())
        except Exception:
            logger.exception("Failed to convert run to spans")
