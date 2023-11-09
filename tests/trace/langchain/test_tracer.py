from json import loads
from typing import List
from uuid import UUID

import httpx
import numpy as np
import pytest
import respx
from langchain.chains import RetrievalQA
from langchain.chains.retrieval_qa.prompt import PROMPT as RETRIEVAL_QA_PROMPT
from langchain.chat_models import ChatOpenAI
from langchain.embeddings.fake import FakeEmbeddings
from langchain.llms import OpenAI
from langchain.llms.fake import FakeListLLM
from langchain.retrievers import KNNRetriever
from langchain.schema.messages import (
    AIMessage,
    BaseMessage,
    ChatMessage,
    FunctionMessage,
    HumanMessage,
    SystemMessage,
)
from phoenix.experimental.evals.models.openai import OPENAI_API_KEY_ENVVAR_NAME
from phoenix.trace.exporter import NoOpExporter
from phoenix.trace.langchain import OpenInferenceTracer
from phoenix.trace.schemas import SpanException, SpanKind, SpanStatusCode
from phoenix.trace.semantic_conventions import (
    DOCUMENT_CONTENT,
    DOCUMENT_METADATA,
    EXCEPTION_MESSAGE,
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    LLM_INPUT_MESSAGES,
    LLM_MODEL_NAME,
    LLM_OUTPUT_MESSAGES,
    LLM_PROMPT_TEMPLATE,
    LLM_PROMPT_TEMPLATE_VARIABLES,
    LLM_PROMPT_TEMPLATE_VERSION,
    LLM_PROMPTS,
    MESSAGE_CONTENT,
    MESSAGE_ROLE,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    RETRIEVAL_DOCUMENTS,
    MimeType,
)
from phoenix.trace.span_json_decoder import json_string_to_span
from phoenix.trace.span_json_encoder import span_to_json


def test_tracer_llm() -> None:
    question = "What are the colors in a rainbow?"
    answer = "ROYGBIV"
    document = "rainbow colors"
    retriever = KNNRetriever(
        index=np.ones((1, 7)),
        texts=[document],
        embeddings=FakeEmbeddings(size=7),
    )
    tracer = OpenInferenceTracer(exporter=NoOpExporter())
    RetrievalQA.from_chain_type(
        llm=FakeListLLM(responses=[answer]),
        retriever=retriever,
    ).run(question, callbacks=[tracer])

    spans = {span.name: span for span in tracer.span_buffer}

    trace_ids = set(span.context.trace_id for span in spans.values())
    assert len(trace_ids) == 1
    assert UUID(str(next(iter(trace_ids))))

    assert spans["RetrievalQA"].parent_id is None
    assert spans["Retriever"].parent_id is spans["RetrievalQA"].context.span_id
    assert spans["StuffDocumentsChain"].parent_id is spans["RetrievalQA"].context.span_id
    assert spans["LLMChain"].parent_id is spans["StuffDocumentsChain"].context.span_id
    assert spans["FakeListLLM"].parent_id is spans["LLMChain"].context.span_id

    assert spans["RetrievalQA"].span_kind is SpanKind.CHAIN
    assert spans["Retriever"].span_kind is SpanKind.RETRIEVER
    assert spans["StuffDocumentsChain"].span_kind is SpanKind.CHAIN
    assert spans["LLMChain"].span_kind is SpanKind.CHAIN
    assert spans["FakeListLLM"].span_kind is SpanKind.LLM

    assert spans["RetrievalQA"].status_code is SpanStatusCode.OK
    assert spans["Retriever"].status_code is SpanStatusCode.OK
    assert spans["StuffDocumentsChain"].status_code is SpanStatusCode.OK
    assert spans["LLMChain"].status_code is SpanStatusCode.OK
    assert spans["FakeListLLM"].status_code is SpanStatusCode.OK

    attributes = spans["RetrievalQA"].attributes
    assert attributes.get(INPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert attributes.get(OUTPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert attributes.get(INPUT_VALUE) is question
    assert attributes.get(OUTPUT_VALUE) is answer

    attributes = spans["Retriever"].attributes
    assert attributes.get(INPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert attributes.get(OUTPUT_MIME_TYPE) is MimeType.JSON
    assert attributes.get(INPUT_VALUE) is question
    assert loads(attributes.get(OUTPUT_VALUE))
    assert attributes.get(RETRIEVAL_DOCUMENTS) == [
        {
            DOCUMENT_CONTENT: document,
            DOCUMENT_METADATA: {},
        }
    ]

    attributes = spans["StuffDocumentsChain"].attributes
    assert attributes.get(INPUT_MIME_TYPE) is MimeType.JSON
    assert attributes.get(OUTPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert loads(attributes.get(INPUT_VALUE))
    assert attributes.get(OUTPUT_VALUE) is answer

    attributes = spans["LLMChain"].attributes
    assert attributes.get(INPUT_MIME_TYPE) is MimeType.JSON
    assert attributes.get(OUTPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert loads(attributes.get(INPUT_VALUE))
    assert attributes.get(OUTPUT_VALUE) is answer
    assert attributes.get(LLM_PROMPT_TEMPLATE) == RETRIEVAL_QA_PROMPT.template
    assert attributes.get(LLM_PROMPT_TEMPLATE_VARIABLES) == RETRIEVAL_QA_PROMPT.input_variables
    assert attributes.get(LLM_PROMPT_TEMPLATE_VERSION) == "unknown"

    attributes = spans["FakeListLLM"].attributes
    assert attributes.get(INPUT_MIME_TYPE) is MimeType.JSON
    assert attributes.get(OUTPUT_MIME_TYPE) is MimeType.JSON
    assert loads(attributes.get(INPUT_VALUE))
    assert loads(attributes.get(OUTPUT_VALUE))
    assert isinstance((prompts := attributes.get(LLM_PROMPTS)), list)
    assert len(prompts) == 1
    assert question in prompts[0]

    for span in spans.values():
        assert json_string_to_span(span_to_json(span)) == span


@respx.mock
@pytest.mark.parametrize(
    "messages",
    [
        pytest.param(
            [
                ChatMessage(role="system", content="system-message-content"),
                ChatMessage(role="user", content="user-message-content"),
                ChatMessage(role="assistant", content="assistant-message-content"),
                ChatMessage(role="function", content="function-message-content"),
            ],
            id="chat-messages",
        ),
        pytest.param(
            [
                SystemMessage(content="system-message-content"),
                HumanMessage(content="user-message-content"),
                AIMessage(content="assistant-message-content"),
                FunctionMessage(name="function-name", content="function-message-content"),
            ],
            id="non-chat-messages",
        ),
    ],
)
def test_tracer_llm_message_attributes_with_chat_completions_api(
    messages: List[BaseMessage], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    tracer = OpenInferenceTracer(exporter=NoOpExporter())
    model_name = "gpt-4"
    llm = ChatOpenAI(model_name=model_name)
    expected_response = "response-text"
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=httpx.Response(
            status_code=200,
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
    response = llm(messages, callbacks=[tracer])

    spans = list(tracer.get_spans())
    assert len(spans) == 1
    span = spans[0]
    attributes = span.attributes

    assert response.content == expected_response
    assert attributes[LLM_MODEL_NAME] == model_name
    assert attributes[LLM_INPUT_MESSAGES] == [
        {MESSAGE_ROLE: "system", MESSAGE_CONTENT: "system-message-content"},
        {MESSAGE_ROLE: "user", MESSAGE_CONTENT: "user-message-content"},
        {MESSAGE_ROLE: "assistant", MESSAGE_CONTENT: "assistant-message-content"},
        {MESSAGE_ROLE: "function", MESSAGE_CONTENT: "function-message-content"},
    ]
    assert attributes[LLM_OUTPUT_MESSAGES] == [
        {"message.content": "response-text", "message.role": "assistant"}
    ]
    assert LLM_PROMPTS not in attributes


@respx.mock
def test_tracer_llm_prompt_attributes_with_completions_api(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(OPENAI_API_KEY_ENVVAR_NAME, "sk-0123456789")
    tracer = OpenInferenceTracer(exporter=NoOpExporter())
    model_name = "text-davinci-003"
    llm = OpenAI(model_name=model_name, n=3)
    expected_response_texts = [
        "prompt-0-response-0",
        "prompt-0-response-1",
        "prompt-0-response-2",
        "prompt-1-response-0",
        "prompt-1-response-1",
        "prompt-1-response-2",
    ]
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=httpx.Response(
            status_code=200,
            json={
                "id": "cmpl-uqkvlQyYK7bGYrRHQ0eXlWi7",
                "object": "text_completion",
                "created": 1589478378,
                "model": model_name,
                "choices": [
                    {
                        "text": response_text,
                        "index": index,
                        "logprobs": None,
                        "finish_reason": "stop",
                    }
                    for index, response_text in enumerate(expected_response_texts)
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3},
            },
        )
    )
    input_prompts = ["prompt-0", "prompt-1"]
    result = llm.generate(input_prompts, callbacks=[tracer])
    spans = list(tracer.get_spans())

    for prompt_index, generations in enumerate(result.generations):
        for response_index, generation in enumerate(generations):
            assert generation.text == f"prompt-{prompt_index}-response-{response_index}"

    assert len(spans) == 2
    for span_index, span in enumerate(tracer.get_spans()):
        assert span.span_kind == SpanKind.LLM
        attributes = span.attributes
        assert attributes[LLM_MODEL_NAME] == model_name
        assert attributes[LLM_PROMPTS] == [input_prompts[span_index]]
        assert LLM_INPUT_MESSAGES not in attributes
        assert LLM_OUTPUT_MESSAGES not in attributes


def test_tracer_llm_with_exception() -> None:
    question = "What are the colors in a rainbow?"
    document = "rainbow colors"
    retriever = KNNRetriever(
        index=np.ones((1, 7)),
        texts=[document],
        embeddings=FakeEmbeddings(size=7),
    )
    tracer = OpenInferenceTracer(exporter=NoOpExporter())
    chain = RetrievalQA.from_chain_type(
        llm=FakeListLLM(responses=[]),
        retriever=retriever,
    )
    try:
        chain.run(question, callbacks=[tracer])
    except Exception:
        pass

    spans = {span.name: span for span in tracer.span_buffer}

    assert spans["Retriever"].status_code is SpanStatusCode.OK

    for name in (
        "RetrievalQA",
        "StuffDocumentsChain",
        "LLMChain",
        "FakeListLLM",
    ):
        assert spans[name].status_code is SpanStatusCode.ERROR
        events = {event.name: event for event in spans[name].events}
        exception = events.get("exception")
        assert isinstance(exception, SpanException)
        assert exception.attributes[EXCEPTION_MESSAGE].startswith("IndexError")

    assert spans["Retriever"].attributes[RETRIEVAL_DOCUMENTS] == [
        {
            DOCUMENT_CONTENT: document,
            DOCUMENT_METADATA: {},
        },
    ]

    for span in spans.values():
        assert json_string_to_span(span_to_json(span)) == span


def test_tracer_retriever_with_exception() -> None:
    question = "What are the colors in a rainbow?"
    answer = "ROYGBIV"
    retriever = KNNRetriever(
        index=np.ones((1, 7)),
        texts=[],
        embeddings=FakeEmbeddings(size=7),
    )
    tracer = OpenInferenceTracer(exporter=NoOpExporter())
    chain = RetrievalQA.from_chain_type(
        llm=FakeListLLM(responses=[answer]),
        retriever=retriever,
    )
    try:
        chain.run(question, callbacks=[tracer])
    except Exception:
        pass

    spans = {span.name: span for span in tracer.get_spans()}

    for name in (
        "RetrievalQA",
        "Retriever",
    ):
        events = {event.name: event for event in spans[name].events}
        exception = events.get("exception")
        assert isinstance(exception, SpanException)
        assert exception.attributes[EXCEPTION_MESSAGE].startswith("IndexError")

    assert spans["Retriever"].attributes[RETRIEVAL_DOCUMENTS] == []

    for span in spans.values():
        assert json_string_to_span(span_to_json(span)) == span
