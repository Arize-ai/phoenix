from datetime import datetime
from unittest.mock import patch

import pytest
import responses
from llama_index import ListIndex, ServiceContext, get_response_synthesizer
from llama_index.callbacks import CallbackManager
from llama_index.llms import OpenAI
from llama_index.query_engine import RetrieverQueryEngine
from llama_index.schema import Document, TextNode
from openai import ChatCompletion
from openai.error import RateLimitError
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


@responses.activate
def test_callback_llm_span_contains_template_attributes(
    monkeypatch: pytest.MonkeyPatch,
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
    responses.post(
        "https://api.openai.com/v1/chat/completions",
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
        status=200,
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

    with patch.object(ChatCompletion, "create") as mocked_chat_completion_create:
        mocked_chat_completion_create.side_effect = RateLimitError("message")
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
