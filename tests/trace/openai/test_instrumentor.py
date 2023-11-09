import json
from importlib import reload

import httpx
import openai
import pytest
from openai import AuthenticationError, OpenAI
from phoenix.trace.openai.instrumentor import OpenAIInstrumentor
from phoenix.trace.schemas import SpanException, SpanKind, SpanStatusCode
from phoenix.trace.semantic_conventions import (
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
    EXCEPTION_TYPE,
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    LLM_FUNCTION_CALL,
    LLM_INPUT_MESSAGES,
    LLM_INVOCATION_PARAMETERS,
    LLM_OUTPUT_MESSAGES,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
    MESSAGE_CONTENT,
    MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON,
    MESSAGE_FUNCTION_CALL_NAME,
    MESSAGE_NAME,
    MESSAGE_ROLE,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    MimeType,
)
from phoenix.trace.tracer import Tracer


@pytest.fixture
def reload_openai_client() -> None:
    """Reloads openai.api_requestor to reset the instrumented class method."""
    reload(openai._base_client)
    reload(openai)


@pytest.fixture
def openai_api_key(monkeypatch) -> None:
    api_key = "sk-0123456789"
    monkeypatch.setenv("OPENAI_API_KEY", api_key)
    return api_key


@pytest.fixture
def client(openai_api_key) -> OpenAI:
    return OpenAI(api_key=openai_api_key)


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_openai_instrumentor_includes_llm_attributes_on_chat_completion_success(
    # reload_openai_client,
    respx_mock,
    openai_api_key,
) -> None:
    tracer = Tracer()
    OpenAIInstrumentor(tracer).instrument()
    client = OpenAI(api_key=openai_api_key)
    model = "gpt-4"
    messages = [{"role": "user", "content": "Who won the World Cup in 2018?"}]
    temperature = 0.23
    expected_response_text = "France won the World Cup in 2018."

    respx_mock.post("/chat/completions").mock(
        side_effect=lambda request, route: httpx.Response(
            200,
            json={
                "id": "chatcmpl-85eo7phshROhvmDvNeMVatGolg9JV",
                "object": "chat.completion",
                "created": 1696359195,
                "model": "gpt-4-0613",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": expected_response_text,
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 17, "completion_tokens": 10, "total_tokens": 27},
            },
        )
    )
    response = client.chat.completions.create(
        model=model, messages=messages, temperature=temperature
    )
    response_text = response.choices[0].message.content

    assert response_text == expected_response_text

    spans = list(tracer.get_spans())
    assert len(spans) == 1
    span = spans[0]
    attributes = span.attributes

    assert span.span_kind is SpanKind.LLM
    assert span.status_code == SpanStatusCode.OK
    assert span.events == []
    assert attributes[LLM_INPUT_MESSAGES] == [
        {MESSAGE_ROLE: "user", MESSAGE_CONTENT: "Who won the World Cup in 2018?"}
    ]
    assert (
        json.loads(attributes[LLM_INVOCATION_PARAMETERS])
        == json.loads(attributes[INPUT_VALUE])
        == {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
    )
    assert attributes[INPUT_MIME_TYPE] == MimeType.JSON
    assert isinstance(attributes[LLM_TOKEN_COUNT_COMPLETION], int)
    assert isinstance(attributes[LLM_TOKEN_COUNT_PROMPT], int)
    assert isinstance(attributes[LLM_TOKEN_COUNT_TOTAL], int)

    choices = json.loads(attributes[OUTPUT_VALUE])["choices"]
    assert len(choices) == 1
    response_content = choices[0]["message"]["content"]
    assert "france" in response_content.lower() or "french" in response_content.lower()
    assert attributes[OUTPUT_MIME_TYPE] == MimeType.JSON


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_openai_instrumentor_includes_function_call_attributes(
    # reload_openai_api_requestor,
    openai_api_key,
    respx_mock,
    client,
) -> None:
    tracer = Tracer()
    OpenAIInstrumentor(tracer).instrument()
    messages = [
        {"role": "user", "content": "What is the weather like in Boston, MA?"},
    ]
    functions = [
        {
            "name": "get_current_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g., San Francisco, CA",
                    },
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                },
                "required": ["location"],
            },
        }
    ]
    model = "gpt-4"

    respx_mock.post("/chat/completions").mock(
        side_effect=lambda request, route: httpx.Response(
            200,
            json={
                "id": "chatcmpl-85eqK3CCNTHQcTN0ZoWqL5B0OO5ip",
                "object": "chat.completion",
                "created": 1696359332,
                "model": "gpt-4-0613",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": None,
                            "function_call": {
                                "name": "get_current_weather",
                                "arguments": '{\n  "location": "Boston, MA"\n}',
                            },
                        },
                        "finish_reason": "function_call",
                    }
                ],
                "usage": {"prompt_tokens": 84, "completion_tokens": 18, "total_tokens": 102},
            },
        )
    )
    response = client.chat.completions.create(model=model, messages=messages, functions=functions)

    function_call = response.choices[0].message.function_call
    assert function_call.name == "get_current_weather"
    assert json.loads(function_call.arguments) == {"location": "Boston, MA"}

    spans = list(tracer.get_spans())
    assert len(spans) == 1
    span = spans[0]
    attributes = span.attributes

    assert span.span_kind is SpanKind.LLM
    assert span.status_code == SpanStatusCode.OK
    assert attributes[LLM_INPUT_MESSAGES] == [
        {MESSAGE_ROLE: "user", MESSAGE_CONTENT: "What is the weather like in Boston, MA?"},
    ]
    assert attributes[LLM_OUTPUT_MESSAGES] == [
        {
            MESSAGE_ROLE: "assistant",
            MESSAGE_FUNCTION_CALL_NAME: "get_current_weather",
            MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON: '{\n  "location": "Boston, MA"\n}',
        }
    ]
    assert json.loads(attributes[LLM_INVOCATION_PARAMETERS]) == {
        "model": model,
        "messages": messages,
        "functions": functions,
    }

    function_call_attributes = json.loads(attributes[LLM_FUNCTION_CALL])
    assert set(function_call_attributes.keys()) == {"name", "arguments"}
    assert function_call_attributes["name"] == "get_current_weather"
    function_call_arguments = json.loads(function_call_attributes["arguments"])
    assert function_call_arguments == {"location": "Boston, MA"}
    assert span.events == []


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_openai_instrumentor_includes_function_call_message_attributes(respx_mock, client) -> None:
    tracer = Tracer()
    OpenAIInstrumentor(tracer).instrument()
    messages = [
        {"role": "user", "content": "What is the weather like in Boston?"},
        {
            "role": "assistant",
            "content": None,
            "function_call": {
                "name": "get_current_weather",
                "arguments": '{"location": "Boston, MA"}',
            },
        },
        {
            "role": "function",
            "name": "get_current_weather",
            "content": '{"temperature": "22", "unit": "celsius", "description": "Sunny"}',
        },
    ]
    functions = [
        {
            "name": "get_current_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA",
                    },
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                },
                "required": ["location"],
            },
        }
    ]
    model = "gpt-4"
    respx_mock.post("/chat/completions").mock(
        side_effect=lambda request, route: httpx.Response(
            200,
            json={
                "id": "chatcmpl-85euch0n5ruhawemogmak8cdwyqcb",
                "object": "chat.completion",
                "created": 1696359572,
                "model": "gpt-4-0613",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": (
                                "The current weather in Boston is sunny "
                                "with a temperature of 22 degrees celsius."
                            ),
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 126, "completion_tokens": 17, "total_tokens": 143},
            },
        )
    )

    response = client.chat.completions.create(model=model, messages=messages, functions=functions)
    response_text = response.choices[0].message.content
    spans = list(tracer.get_spans())
    span = spans[0]
    attributes = span.attributes

    assert "22" in response_text and "Boston" in response_text
    assert len(spans) == 1
    assert span.span_kind is SpanKind.LLM
    assert span.status_code == SpanStatusCode.OK
    assert span.events == []
    assert attributes[LLM_INPUT_MESSAGES] == [
        {MESSAGE_ROLE: "user", MESSAGE_CONTENT: "What is the weather like in Boston?"},
        {
            MESSAGE_ROLE: "assistant",
            MESSAGE_FUNCTION_CALL_NAME: "get_current_weather",
            MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON: '{"location": "Boston, MA"}',
        },
        {
            MESSAGE_ROLE: "function",
            MESSAGE_NAME: "get_current_weather",
            MESSAGE_CONTENT: '{"temperature": "22", "unit": "celsius", "description": "Sunny"}',
        },
    ]
    assert attributes[LLM_OUTPUT_MESSAGES] == [
        {MESSAGE_ROLE: "assistant", MESSAGE_CONTENT: response_text}
    ]
    assert json.loads(attributes[LLM_INVOCATION_PARAMETERS]) == {
        "model": model,
        "messages": messages,
        "functions": functions,
    }
    assert LLM_FUNCTION_CALL not in attributes


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_openai_instrumentor_records_authentication_error(
    openai_api_key,
    client,
    respx_mock,
) -> None:
    tracer = Tracer()
    OpenAIInstrumentor(tracer).instrument()
    respx_mock.post("/chat/completions").mock(
        side_effect=lambda request, route: httpx.Response(
            401,
            json={
                "error": {
                    "message": "error-message",
                    "type": "invalid_request_error",
                    "param": None,
                    "code": "invalid_api_key",
                }
            },
        )
    )
    model = "gpt-4"
    messages = [{"role": "user", "content": "Who won the World Cup in 2018?"}]

    with pytest.raises(AuthenticationError):
        client.chat.completions.create(model=model, messages=messages)

    spans = list(tracer.get_spans())
    assert len(spans) == 1
    span = spans[0]
    events = span.events
    assert len(events) == 1
    event = events[0]
    assert isinstance(event, SpanException)
    attributes = event.attributes
    assert attributes[EXCEPTION_TYPE] == "AuthenticationError"
    assert "error-message" in attributes[EXCEPTION_MESSAGE]
    assert "Traceback" in attributes[EXCEPTION_STACKTRACE]


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_openai_instrumentor_does_not_interfere_with_completions_api(respx_mock, client) -> None:
    tracer = Tracer()
    OpenAIInstrumentor(tracer).instrument()
    model = "gpt-3.5-turbo-instruct"
    prompt = "Who won the World Cup in 2018?"
    respx_mock.post("/completions").mock(
        side_effect=lambda request, route: httpx.Response(
            200,
            json={
                "id": "cmpl-85hqvKwCud3s3DWc80I0OeNmkfjSM",
                "object": "text_completion",
                "created": 1696370901,
                "model": "gpt-3.5-turbo-instruct",
                "choices": [
                    {
                        "text": "\n\nFrance won the 2018 World Cup.",
                        "index": 0,
                        "logprobs": None,
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20},
            },
        )
    )

    response = client.completions.create(model=model, prompt=prompt)
    response_text = response.choices[0].text
    spans = list(tracer.get_spans())

    assert "france" in response_text.lower() or "french" in response_text.lower()
    assert spans == []


@pytest.mark.respx(base_url="https://api.openai.com/v1")
def test_openai_instrumentor_instrument_method_is_idempotent(
    # reload_openai_api_requestor,
    client,
    openai_api_key,
    respx_mock,
) -> None:
    tracer = Tracer()
    OpenAIInstrumentor(tracer).instrument()  # first call
    OpenAIInstrumentor(tracer).instrument()  # second call
    model = "gpt-4"
    messages = [{"role": "user", "content": "Who won the World Cup in 2018?"}]
    respx_mock.post("/chat/completions").mock(
        side_effect=lambda request, route: httpx.Response(
            200,
            json={
                "id": "chatcmpl-85evOVGg6afU8iqiUsRtYQ5lYnGwn",
                "object": "chat.completion",
                "created": 1696359646,
                "model": "gpt-4-0613",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": "France won the World Cup in 2018.",
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 17, "completion_tokens": 10, "total_tokens": 27},
            },
        )
    )
    response = client.chat.completions.create(model=model, messages=messages)
    response_text = response.choices[0].message.content
    spans = list(tracer.get_spans())
    span = spans[0]

    assert "france" in response_text.lower() or "french" in response_text.lower()
    assert len(spans) == 1
    assert span.span_kind is SpanKind.LLM
    assert span.status_code == SpanStatusCode.OK
