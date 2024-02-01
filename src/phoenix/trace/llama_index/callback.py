"""
Callback handler for emitting trace data in OpenInference tracing format.
OpenInference tracing is an open standard for capturing and storing
LLM Application execution logs.

It enables production LLMapp servers to seamlessly integrate with LLM
observability solutions such as Arize and Phoenix.

For more information on the specification, see
https://github.com/Arize-ai/openinference
"""
import json
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import (
    Any,
    Callable,
    Dict,
    Iterable,
    Iterator,
    List,
    Mapping,
    Optional,
    Tuple,
    Union,
    cast,
)
from uuid import uuid4

import llama_index
from openinference.instrumentation.llama_index import OpenInferenceTraceCallbackHandler as _OpenInferenceTraceCallbackHandler
from llama_index.callbacks.base_handler import BaseCallbackHandler
from llama_index.callbacks.schema import (
    TIMESTAMP_FORMAT,
    CBEvent,
    CBEventType,
    EventPayload,
)
from llama_index.llms.types import ChatMessage, ChatResponse
from llama_index.response.schema import Response, StreamingResponse
from llama_index.tools import ToolMetadata
from typing_extensions import TypeGuard

from phoenix.trace.exporter import HttpExporter
from phoenix.trace.llama_index.streaming import (
    instrument_streaming_response as _instrument_streaming_response,
)
from phoenix.trace.schemas import (
    MimeType,
    Span,
    SpanEvent,
    SpanException,
    SpanID,
    SpanKind,
    SpanStatusCode,
    TraceID,
)
from phoenix.trace.semantic_conventions import (
    DOCUMENT_CONTENT,
    DOCUMENT_ID,
    DOCUMENT_METADATA,
    DOCUMENT_SCORE,
    EMBEDDING_EMBEDDINGS,
    EMBEDDING_MODEL_NAME,
    EMBEDDING_TEXT,
    EMBEDDING_VECTOR,
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    LLM_INPUT_MESSAGES,
    LLM_INVOCATION_PARAMETERS,
    LLM_MODEL_NAME,
    LLM_OUTPUT_MESSAGES,
    LLM_PROMPT_TEMPLATE,
    LLM_PROMPT_TEMPLATE_VARIABLES,
    LLM_PROMPTS,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
    MESSAGE_CONTENT,
    MESSAGE_NAME,
    MESSAGE_ROLE,
    MESSAGE_TOOL_CALLS,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    RERANKER_INPUT_DOCUMENTS,
    RERANKER_MODEL_NAME,
    RERANKER_OUTPUT_DOCUMENTS,
    RERANKER_QUERY,
    RERANKER_TOP_K,
    RETRIEVAL_DOCUMENTS,
    TOOL_CALL_FUNCTION_ARGUMENTS_JSON,
    TOOL_CALL_FUNCTION_NAME,
    TOOL_DESCRIPTION,
    TOOL_NAME,
    TOOL_PARAMETERS,
)
from phoenix.trace.tracer import SpanExporter, Tracer
from phoenix.trace.utils import extract_version_triplet, get_stacktrace
from phoenix.utilities.error_handling import graceful_fallback
from phoenix.trace.tracer import OpenInferenceTracer, Tracer, _convert_legacy_tracer

LLAMA_INDEX_MINIMUM_VERSION_TRIPLET = (0, 9, 8)
logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())

CBEventID = str
_LOCAL_TZINFO = datetime.now().astimezone().tzinfo





class OpenInferenceTraceCallbackHandler(BaseCallbackHandler):
    """Callback handler for storing LLM application trace data in OpenInference format.
    OpenInference is an open standard for capturing and storing AI model
    inferences. It enables production LLMapp servers to seamlessly integrate
    with LLM observability solutions such as Arize and Phoenix.

    For more information on the specification, see
    https://github.com/Arize-ai/openinference
    """

    def __init__(
        self,
        callback: Optional[Callable[[List[Span]], None]] = None,
        exporter: Optional[Union[OpenInferenceExporter, SpanExporter]] = None,
    ) -> None:
        self._tracer = OpenInferenceTracer(exporter=exporter)
        self._openinference_callback_handler = _OpenInferenceTraceCallbackHandler(tracer=self._tracer.get_tracer())

    def on_event_start(self, *args, **kwargs):
        return self._openinference_callback_handler.on_event_start(*args, **kwargs)

    def on_event_end(self, *args, **kwargs):
        return self._openinference_callback_handler.on_event_end(*args, **kwargs)

    def start_trace(self, *args, **kwargs):
        return self._openinference_callback_handler.start_trace(*args, **kwargs)

    def end_trace(self, *args, **kwargs):
        return self._openinference_callback_handler.end_trace(*args, **kwargs)
