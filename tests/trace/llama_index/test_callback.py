from datetime import datetime
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest
import respx
from llama_index import ListIndex, ServiceContext, get_response_synthesizer
from llama_index.callbacks import CallbackManager
from llama_index.callbacks.schema import CBEventType
from llama_index.llms import (
    CompletionResponse,
    CompletionResponseGen,
    CustomLLM,
    LLMMetadata,
    OpenAI,
)
from llama_index.llms.base import llm_completion_callback
from llama_index.query_engine import RetrieverQueryEngine
from llama_index.schema import Document, TextNode
from openai import RateLimitError
from phoenix.experimental.evals.models.openai import OPENAI_API_KEY_ENVVAR_NAME
from phoenix.trace.exporter import NoOpExporter
from phoenix.trace.llama_index import OpenInferenceTraceCallbackHandler
from phoenix.trace.schemas import SpanException, SpanKind, SpanStatusCode
from phoenix.trace.semantic_conventions import (
    DOCUMENT_METADATA,
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
    EXCEPTION_TYPE,
    INPUT_VALUE,
    LLM_PROMPT_TEMPLATE,
    LLM_PROMPT_TEMPLATE_VARIABLES,
    LLM_TOKEN_COUNT_TOTAL,
    OUTPUT_VALUE,
    RETRIEVAL_DOCUMENTS,
)
from phoenix.trace.span_json_decoder import json_string_to_span
from phoenix.trace.span_json_encoder import span_to_json

nodes = [
    Document(
        text="The Great Pyramid of Giza is one of the seven wonders",
        id="0",
        metadata={"filename": "egypt.txt", "category": "pyramid"},
    ),
    TextNode(text="The Hanging Gardens of Babylon is one of the seven wonders", id="1"),
]


class CallbackError(Exception):
    pass


def test_callback_llm(mock_service_context: ServiceContext) -> None:
    question = "What are the seven wonders of the world?"
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    index = ListIndex(nodes)
    retriever = index.as_retriever(retriever_mode="default")
    response_synthesizer = get_response_synthesizer()

    query_engine = RetrieverQueryEngine(
        retriever=retriever,
        response_synthesizer=response_synthesizer,
        callback_manager=CallbackManager([callback_handler]),
    )

    response = query_engine.query(question)
    # Just check that the callback handler is called using the patched LLM
    assert response.response == "LLM predict"
    spans = list(callback_handler.get_spans())
    assert len(spans) >= 1
    # Make sure that the input/output is captured
    assert spans[0].attributes[INPUT_VALUE] == question
    assert spans[0].attributes[OUTPUT_VALUE] == response.response
    assert spans[1].attributes[RETRIEVAL_DOCUMENTS][0][DOCUMENT_METADATA] == nodes[0].metadata
    assert list(map(json_string_to_span, map(span_to_json, spans))) == spans


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_callback_llm_span_contains_template_attributes(
    monkeypatch: pytest.MonkeyPatch,
    respx_mock: respx.mock,
) -> None:
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    model_name = "gpt-3.5-turbo"
    llm = OpenAI(model=model_name, max_retries=1)
    query = "What are the seven wonders of the world?"
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    index = ListIndex(nodes)
    service_context = ServiceContext.from_defaults(
        llm=llm, callback_manager=CallbackManager([callback_handler])
    )
    query_engine = index.as_query_engine(service_context=service_context)
    expected_response = "The seven wonders of the world are: 1, 2, 3, 4, 5, 6, 7"
    respx_mock.post(
        "https://api.openai.com/v1/chat/completions",
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "id": "chatcmpl-123",
                "object": "chat.completion",
                "created": 1677652288,
                "model": model_name,
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": expected_response},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3},
            },
        )
    )

    response = query_engine.query(query)

    assert response.response == expected_response
    spans = list(callback_handler.get_spans())
    assert all(span.status_code == SpanStatusCode.OK for span in spans)
    assert all(len(span.events) == 0 for span in spans)
    assert not any(
        span.name.startswith("templat") for span in spans
    )  # check that all template events have been removed
    span = next(span for span in spans if span.span_kind == SpanKind.LLM)
    assert isinstance(span.attributes[LLM_PROMPT_TEMPLATE], str)
    assert isinstance(span.attributes[LLM_PROMPT_TEMPLATE_VARIABLES], dict)


def test_callback_llm_rate_limit_error_has_exception_event(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    llm = OpenAI(model="gpt-3.5-turbo", max_retries=1)
    query = "What are the seven wonders of the world?"
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    index = ListIndex(nodes)
    service_context = ServiceContext.from_defaults(
        llm=llm, callback_manager=CallbackManager([callback_handler])
    )
    query_engine = index.as_query_engine(service_context=service_context)

    with patch.object(llm._client.chat.completions, "create") as mocked_chat_completion_create:
        mocked_chat_completion_create.side_effect = RateLimitError(
            "message",
            response=httpx.Response(
                429, request=httpx.Request(method="post", url="https://api.openai.com/")
            ),
            body={},
        )
        with pytest.raises(RateLimitError):
            query_engine.query(query)

    spans = list(callback_handler.get_spans())
    assert all(
        span.status_code == SpanStatusCode.OK for span in spans if span.span_kind != SpanKind.LLM
    )
    span = next(span for span in spans if span.span_kind == SpanKind.LLM)
    assert span.status_code == SpanStatusCode.ERROR
    events = span.events
    event = events[0]
    assert isinstance(event, SpanException)
    assert isinstance(event.timestamp, datetime)
    assert len(event.attributes) == 3
    assert event.attributes[EXCEPTION_TYPE] == "RateLimitError"
    assert event.attributes[EXCEPTION_MESSAGE] == "message"
    assert isinstance(event.attributes[EXCEPTION_STACKTRACE], str)


def test_callback_llm_rate_limit_error_has_exception_event_with_missing_start(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    event_type = CBEventType.EXCEPTION
    payload = {"some": "payload"}
    event_id = str(uuid4())
    trace_map = {"root": [event_id]}

    # create an exception event without a corresponding start event
    callback_handler.on_event_end(event_type, payload=payload, event_id=event_id)
    with patch.object(callback_handler._tracer, "create_span") as mocked_span_creation:
        callback_handler.end_trace(trace_map=trace_map)

    assert mocked_span_creation.call_count == 0, "don't create spans on exception events"


@patch("phoenix.trace.llama_index.callback.payload_to_semantic_attributes")
def test_on_event_start_handler_fails_gracefully(
    mock_handler_internals, mock_service_context: ServiceContext, caplog
) -> None:
    # callback handlers should *never* introduce errors in user code if they fail
    question = "What are the seven wonders of the world?"
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    index = ListIndex(nodes)
    retriever = index.as_retriever(retriever_mode="default")
    response_synthesizer = get_response_synthesizer()

    query_engine = RetrieverQueryEngine(
        retriever=retriever,
        response_synthesizer=response_synthesizer,
        callback_manager=CallbackManager([callback_handler]),
    )

    mock_handler_internals.side_effect = CallbackError("callback exception")
    query_engine.query(question)

    assert caplog.records[0].levelname == "ERROR"
    assert "on_event_start" in caplog.records[0].message
    assert "CallbackError" in caplog.records[0].message


def test_on_event_start_handler_is_not_called_before_end_handler(
    mock_service_context: ServiceContext, caplog
) -> None:
    question = "What are the seven wonders of the world?"
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    index = ListIndex(nodes)
    retriever = index.as_retriever(retriever_mode="default")
    response_synthesizer = get_response_synthesizer()

    query_engine = RetrieverQueryEngine(
        retriever=retriever,
        response_synthesizer=response_synthesizer,
        callback_manager=CallbackManager([callback_handler]),
    )

    with patch.object(callback_handler, "on_event_start"):
        # mock the on_event_start method to be a no-op
        query_engine.query(question)

    records = caplog.records
    assert len(records) == 0, "on_event_end does not break if on_event_start is not called"


def test_on_event_end_handler_fails_gracefully(
    mock_service_context: ServiceContext, caplog
) -> None:
    event_type = CBEventType.QUERY
    faulty_payload = {"faulty": "payload"}
    event_id = str(uuid4())
    parent_id = str(uuid4())

    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    callback_handler.on_event_end(event_type, faulty_payload, event_id)
    callback_handler.on_event_start(event_type, dict(), event_id, parent_id)  # start event first
    with patch(
        "phoenix.trace.llama_index.callback.payload_to_semantic_attributes"
    ) as mock_internals:
        mock_internals.side_effect = RuntimeError("on_event_end test error")
        callback_handler.on_event_end(event_type, faulty_payload, event_id)

    records = caplog.records
    assert len(records) == 1
    assert records[0].levelname == "ERROR"
    assert "on_event_end" in records[0].message
    assert "on_event_end test error" in records[0].message


@patch("phoenix.trace.llama_index.callback._add_spans_to_tracer")
def test_end_trace_handler_fails_gracefully(mock_handler_internals, caplog) -> None:
    trace_id = str(uuid4())
    trace_map = {str(uuid4()): [str(uuid4())]}
    mock_handler_internals.side_effect = CallbackError("callback exception")
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    callback_handler.end_trace(trace_id, trace_map=trace_map)

    assert caplog.records[0].levelname == "ERROR"
    assert "end_trace" in caplog.records[0].message
    assert "CallbackError" in caplog.records[0].message


def test_custom_llm(mock_embed_model) -> None:
    """Make sure token counts are captured when a custom LLM such as lama2-13B is used."""

    prompt_tokens = 100
    completion_tokens = 200

    def sendPromptToLama(prompt: str):
        return (
            "LLM Predict",
            prompt_tokens,
            completion_tokens,
            {
                "text": "LLM Predict",
            },
        )

    class Llama2(CustomLLM):
        @property
        def metadata(self) -> LLMMetadata:
            """Get LLM metadata."""
            return LLMMetadata(
                context_window=4000,
                num_output=100,
                model_name="lama2-13B",
            )

        @llm_completion_callback()
        def complete(self, prompt: str, **kwargs: Any) -> CompletionResponse:
            (text, input_tokens, output_tokens, response) = sendPromptToLama(prompt)

            additional_kwargs = {
                "prompt_tokens": input_tokens,
                "completion_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
            }
            return CompletionResponse(text=text, raw=response, additional_kwargs=additional_kwargs)

        @llm_completion_callback()
        def stream_complete(self, prompt: str, **kwargs: Any) -> CompletionResponseGen:
            raise NotImplementedError()

    llm = Llama2()

    question = "What are the seven wonders of the world?"
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    callback_manager = CallbackManager([callback_handler])
    index = ListIndex(nodes)
    retriever = index.as_retriever(retriever_mode="default")
    service_context = ServiceContext.from_defaults(
        llm=llm, embed_model=mock_embed_model, callback_manager=callback_manager
    )
    response_synthesizer = get_response_synthesizer(service_context)
    query_engine = RetrieverQueryEngine(
        retriever=retriever,
        response_synthesizer=response_synthesizer,
        callback_manager=callback_manager,
    )

    response = query_engine.query(question)

    # Just check that the callback handler is called using the patched LLM
    assert response.response == "LLM Predict"
    spans = list(callback_handler.get_spans())
    assert len(spans) >= 1
    llm_spans = [span for span in spans if span.span_kind == SpanKind.LLM]
    assert len(llm_spans) == 1
    # Make sure the custom token counts are captured from the kwargs
    assert llm_spans[0].attributes[LLM_TOKEN_COUNT_TOTAL] == prompt_tokens + completion_tokens
