import json
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
from openai import InternalServerError
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


def test_callback_llm(openai_api_key, mock_service_context: ServiceContext) -> None:
    question = "What are the seven wonders of the world?"
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    callback_manager = CallbackManager([callback_handler])
    index = ListIndex(nodes)
    retriever = index.as_retriever(retriever_mode="default", callback_manager=callback_manager)
    response_synthesizer = get_response_synthesizer()

    query_engine = RetrieverQueryEngine(
        retriever=retriever,
        response_synthesizer=response_synthesizer,
        callback_manager=callback_manager,
    )

    response = query_engine.query(question)
    # TODO: this check has been switched to "false" after LlamaIndex deprecated LLMPredictors
    # even though our tests still generally pass, we should investiate why this is the case
    assert not response.response == "LLM predict"
    spans = list(callback_handler.get_spans())
    assert len(spans) >= 1
    # Make sure that the input/output is captured
    assert spans[0].attributes[INPUT_VALUE] == question
    assert spans[0].attributes[OUTPUT_VALUE] == response.response
    assert spans[1].attributes[RETRIEVAL_DOCUMENTS][0][DOCUMENT_METADATA] == nodes[0].metadata
    assert list(map(json_string_to_span, map(span_to_json, spans))) == spans


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_callback_llm_span_contains_template_attributes(
    openai_api_key: str,
    respx_mock: respx.mock,
) -> None:
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


def test_callback_streaming_response_produces_correct_result(
    openai_api_key: str,
    respx_mock: respx.mock,
) -> None:
    model_name = "gpt-3.5-turbo"
    llm = OpenAI(model=model_name, max_retries=1)
    query = "What are the seven wonders of the world?"
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    index = ListIndex(nodes)
    service_context = ServiceContext.from_defaults(
        llm=llm, callback_manager=CallbackManager([callback_handler])
    )
    query_engine = index.as_query_engine(service_context=service_context, streaming=True)
    expected_response_tokens = [
        "",
        "The",
        " seven",
        " wonders",
        " of",
        " the",
        " world",
        " include",
        " the",
        " Great",
        " Pyramid",
        " of",
        " G",
        "iza",
        " and",
        " the",
        " Hanging",
        " Gardens",
        " of",
        " Babylon",
        ".",
        "",
    ]
    expected_response = "".join(expected_response_tokens)
    mock_data = []
    for token_index, token in enumerate(expected_response_tokens):
        response_body = {
            "object": "chat.completion.chunk",
            "created": 1701722737,
            "model": "gpt-4-0613",
            "choices": [
                {
                    "delta": {"role": "assistant", "content": token},
                    "finish_reason": "stop"
                    if token_index == len(expected_response_tokens) - 1
                    else None,
                }
            ],
        }
        mock_data.append(f"data: {json.dumps(response_body)}\n\n".encode("utf-8"))
    mock_data.append(b"data: [DONE]\n")
    url = "https://api.openai.com/v1/chat/completions"
    respx_mock.post(url).respond(
        status_code=200,
        stream=mock_data,
    )
    response = query_engine.query(query)
    response_tokens = list(response.response_gen)
    response_text = "".join(response_tokens)

    assert response_text == expected_response
    spans = list(callback_handler.get_spans())
    assert all(span.status_code == SpanStatusCode.OK for span in spans)
    assert all(len(span.events) == 0 for span in spans)

    span = next(span for span in spans if span.name == "query")
    assert span.attributes[OUTPUT_VALUE] == response_text

    span = next(span for span in spans if span.span_kind == SpanKind.LLM)
    assert isinstance(span.attributes[LLM_PROMPT_TEMPLATE], str)
    assert isinstance(span.attributes[LLM_PROMPT_TEMPLATE_VARIABLES], dict)


def test_callback_internal_error_has_exception_event(
    openai_api_key: str,
) -> None:
    llm = OpenAI(model="gpt-3.5-turbo", max_retries=1)
    query = "What are the seven wonders of the world?"
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    index = ListIndex(nodes)
    service_context = ServiceContext.from_defaults(
        llm=llm, callback_manager=CallbackManager([callback_handler])
    )
    query_engine = index.as_query_engine(service_context=service_context)
    with patch("openai.OpenAI.request") as mocked_chat_completion_create:
        mocked_chat_completion_create.side_effect = InternalServerError(
            "message",
            response=httpx.Response(
                429, request=httpx.Request(method="post", url="https://api.openai.com/")
            ),
            body={},
        )
        with pytest.raises(InternalServerError):
            query_engine.query(query)

    spans = list(callback_handler.get_spans())
    assert all(span.status_code == SpanStatusCode.OK for span in spans if span.name != "synthesize")
    span = next(span for span in spans if span.name == "synthesize")
    assert span.status_code == SpanStatusCode.ERROR
    events = span.events
    event = events[0]
    assert isinstance(event, SpanException)
    assert isinstance(event.timestamp, datetime)
    assert len(event.attributes) == 3
    assert event.attributes[EXCEPTION_TYPE] == "InternalServerError"
    assert event.attributes[EXCEPTION_MESSAGE] == "message"
    assert isinstance(event.attributes[EXCEPTION_STACKTRACE], str)


def test_callback_exception_event_produces_root_chain_span_with_exception_events(
    openai_api_key,
) -> None:
    llm = OpenAI(model="gpt-3.5-turbo", max_retries=1)
    query = "What are the seven wonders of the world?"
    callback_handler = OpenInferenceTraceCallbackHandler(exporter=NoOpExporter())
    index = ListIndex(nodes)
    service_context = ServiceContext.from_defaults(
        llm=llm, callback_manager=CallbackManager([callback_handler])
    )
    query_engine = index.as_query_engine(service_context=service_context)

    # mock the _query method to raise an exception before any event has begun
    # to produce an independent exception event
    with patch.object(query_engine, "_query") as mocked_query:
        mocked_query.side_effect = Exception("message")
        with pytest.raises(Exception):
            query_engine.query(query)

    spans = list(callback_handler.get_spans())
    assert len(spans) == 1
    span = spans[0]
    assert span.span_kind == SpanKind.CHAIN
    assert span.status_code == SpanStatusCode.ERROR
    assert span.name == "exception"
    events = span.events
    event = events[0]
    assert isinstance(event, SpanException)
    assert isinstance(event.timestamp, datetime)
    assert len(event.attributes) == 3
    assert event.attributes[EXCEPTION_TYPE] == "Exception"
    assert event.attributes[EXCEPTION_MESSAGE] == "message"
    assert isinstance(event.attributes[EXCEPTION_STACKTRACE], str)


def test_callback_llm_rate_limit_error_has_exception_event_with_missing_start(
    openai_api_key: str,
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


def test_custom_llm(openai_api_key, mock_embed_model) -> None:
    """Make sure token counts are captured when a custom LLM such as llama2-13B is used."""

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
