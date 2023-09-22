from datetime import datetime
from unittest.mock import patch

import pytest
from llama_index import ListIndex, ServiceContext, get_response_synthesizer
from llama_index.callbacks import CallbackManager
from llama_index.llms import OpenAI
from llama_index.query_engine import RetrieverQueryEngine
from llama_index.schema import Document, TextNode
from openai import ChatCompletion
from openai.error import RateLimitError
from phoenix.trace.exporter import NoOpExporter
from phoenix.trace.llama_index import OpenInferenceTraceCallbackHandler
from phoenix.trace.schemas import SpanException, SpanKind
from phoenix.trace.semantic_conventions import (
    DOCUMENT_METADATA,
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
    EXCEPTION_TYPE,
    INPUT_VALUE,
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


def test_callback_llm_rate_limit_error_records_span_exceptions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "sk-0123456789")
    llm = OpenAI(model="gpt-3.5-turbo", max_retries=2)
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
    span = next(span for span in spans if span.span_kind == SpanKind.LLM)
    events = span.events
    assert len(events) == 1
    event = events[0]
    assert isinstance(event, SpanException)
    assert isinstance(event.timestamp, datetime)
    assert len(event.attributes) == 3
    assert event.attributes[EXCEPTION_TYPE] == "RateLimitError"
    assert event.attributes[EXCEPTION_MESSAGE] == "message"
    assert "Traceback" in event.attributes[EXCEPTION_STACKTRACE]
