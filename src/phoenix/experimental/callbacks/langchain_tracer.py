import json
import logging
from datetime import datetime
from typing import Any, Dict, Iterator, Optional, Tuple

from langchain.callbacks.tracers.base import BaseTracer
from langchain.callbacks.tracers.schemas import Run

from phoenix.trace.schemas import Span, SpanKind, SpanStatusCode
from phoenix.trace.semantic_conventions import (
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    LLM_COMPLETION_TOKENS,
    LLM_FUNCTION_CALL,
    LLM_INVOCATION_PARAMETERS,
    LLM_MODEL_NAME,
    LLM_PROMPT_TEMPLATE,
    LLM_PROMPT_TEMPLATE_VARIABLES,
    LLM_PROMPT_TEMPLATE_VERSION,
    LLM_PROMPT_TOKENS,
    LLM_TOTAL_TOKENS,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    MimeType,
)
from phoenix.trace.tracer import Tracer

Role = str
Message = str

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


def _prompt_template(serialized: Dict[str, Any]) -> Iterator[Tuple[str, Any]]:
    """
    A best-effort attempt to locate the PromptTemplate object among the
    keyword arguments of a serialized object, e.g. an LLMChain object.
    """
    for obj in serialized.get("kwargs", {}).values():
        # The `id` field of the object is a list indicating the path to the
        # object's class in the LangChain package, e.g. `PromptTemplate` in
        # the `langchain.prompts.prompt` module is represented as
        # ["langchain", "prompts", "prompt", "PromptTemplate"]
        try:
            if obj["id"][-1].endswith("PromptTemplate"):
                kwargs = obj.get("kwargs", {})
                if not (template := kwargs.get("template", "")):
                    continue
                yield LLM_PROMPT_TEMPLATE, template
                yield LLM_PROMPT_TEMPLATE_VARIABLES, kwargs.get("input_variables", [])
                yield LLM_PROMPT_TEMPLATE_VERSION, "unknown"
                break
        except (AttributeError, KeyError, TypeError):
            continue


def _invocation_parameters(extra: Dict[str, Any]) -> Iterator[Tuple[str, Any]]:
    for key, value in extra.get("invocation_params", {}).items():
        yield ".".join([LLM_INVOCATION_PARAMETERS, key]), value


def _model_name(extra: Dict[str, Any]) -> Iterator[Tuple[str, str]]:
    for key in ["model_name", "model"]:
        try:
            yield LLM_MODEL_NAME, extra["invocation_params"][key]
            break
        except (KeyError, TypeError):
            continue


def _token_usage(outputs: Dict[str, Any]) -> Iterator[Tuple[str, int]]:
    for attribute_name, key in [
        (LLM_PROMPT_TOKENS, "prompt_tokens"),
        (LLM_COMPLETION_TOKENS, "completion_tokens"),
        (LLM_TOTAL_TOKENS, "total_tokens"),
    ]:
        try:
            yield attribute_name, outputs["llm_output"]["token_usage"][key]
        except (KeyError, TypeError):
            continue


def _function_calls(
    serialized: Dict[str, Any], outputs: Dict[str, Any]
) -> Iterator[Tuple[str, int]]:
    try:
        function_name = outputs["generations"][0][0]["message"]["kwargs"]["additional_kwargs"][
            "function_call"
        ]["name"]
        arguments = json.loads(
            outputs["generations"][0][0]["message"]["kwargs"]["additional_kwargs"]["function_call"][
                "arguments"
            ]
        )
        yield ".".join([LLM_FUNCTION_CALL, function_name]), arguments
    except (KeyError, IndexError, TypeError):
        ...


def _messages(inputs: Dict[str, Any]) -> Iterator[Tuple[str, Tuple[Role, Message]]]:
    # TODO: implement
    ...


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
        attributes.update(_invocation_parameters(run["extra"]))
        attributes.update(_model_name(run["extra"]))
        attributes.update(_token_usage(run["outputs"]))
        attributes.update(_function_calls(run["serialized"], run["outputs"]))
        attributes.update(_messages(run["inputs"]))
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
        try:
            self._convert_run_to_spans(run.dict())
        except Exception:
            logger.exception("Failed to convert run to spans")
