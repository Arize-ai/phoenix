import json
from unittest.mock import patch

import openai
import pytest
from openai.api_requestor import APIRequestor
from openai.error import RateLimitError
from phoenix.trace.openai.instrumentor import OpenAIInstrumentor
from phoenix.trace.schemas import SpanException, SpanKind, SpanStatusCode
from phoenix.trace.semantic_conventions import (
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
    EXCEPTION_TYPE,
    LLM_FUNCTION_CALL,
    LLM_INPUT_MESSAGES,
    LLM_INVOCATION_PARAMETERS,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
    MESSAGE_CONTENT,
    MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON,
    MESSAGE_FUNCTION_CALL_NAME,
    MESSAGE_NAME,
    MESSAGE_ROLE,
)
from phoenix.trace.tracer import Tracer


def test_openai_instrumentor_includes_message_info_on_success() -> None:
    tracer = Tracer()
    OpenAIInstrumentor(tracer).instrument()
    model = "gpt-4"
    messages = [{"role": "user", "content": "Who won the World Cup in 2018?"}]
    temperature = 0.23
    response = openai.ChatCompletion.create(model=model, messages=messages, temperature=temperature)
    print(response)

    spans = list(tracer.get_spans())
    assert len(spans) == 1
    span = spans[0]
    attributes = span.attributes

    assert span.span_kind is SpanKind.LLM
    assert span.status_code == SpanStatusCode.OK
    assert attributes[LLM_INPUT_MESSAGES] == [
        {MESSAGE_ROLE: "user", MESSAGE_CONTENT: "Who won the World Cup in 2018?"}
    ]
    assert attributes[LLM_INVOCATION_PARAMETERS] == {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    assert isinstance(attributes[LLM_TOKEN_COUNT_COMPLETION], int)
    assert isinstance(attributes[LLM_TOKEN_COUNT_PROMPT], int)
    assert isinstance(attributes[LLM_TOKEN_COUNT_TOTAL], int)
    assert span.events == []


def test_openai_instrumentor_includes_function_call_attributes() -> None:
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
    temperature = 0.23
    response = openai.ChatCompletion.create(
        model=model, messages=messages, temperature=temperature, functions=functions
    )

    function_call_data = response.choices[0]["message"]["function_call"]
    assert set(function_call_data.keys()) == {"name", "arguments"}
    assert function_call_data["name"] == "get_current_weather"
    assert json.loads(function_call_data["arguments"]) == {"location": "Boston, MA"}

    spans = list(tracer.get_spans())
    assert len(spans) == 1
    span = spans[0]
    attributes = span.attributes

    assert span.span_kind is SpanKind.LLM
    assert span.status_code == SpanStatusCode.OK
    assert attributes[LLM_INPUT_MESSAGES] == [
        {MESSAGE_ROLE: "user", MESSAGE_CONTENT: "What is the weather like in Boston, MA?"},
    ]
    assert attributes[LLM_INVOCATION_PARAMETERS] == {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "functions": functions,
    }
    function_call_attributes = json.loads(attributes[LLM_FUNCTION_CALL])
    assert set(function_call_attributes.keys()) == {"name", "arguments"}
    assert function_call_attributes["name"] == "get_current_weather"
    function_call_arguments = json.loads(function_call_attributes["arguments"])
    assert function_call_arguments == {"location": "Boston, MA"}
    assert span.events == []


def test_openai_instrumentor_includes_function_call_message_attributes() -> None:
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
    temperature = 0.23
    response = openai.ChatCompletion.create(
        model=model, messages=messages, temperature=temperature, functions=functions
    )

    response_text = response.choices[0]["message"]["content"]
    assert "22" in response_text and "Boston" in response_text

    spans = list(tracer.get_spans())
    assert len(spans) == 1
    span = spans[0]
    attributes = span.attributes

    assert span.span_kind is SpanKind.LLM
    assert span.status_code == SpanStatusCode.OK
    assert attributes[LLM_INPUT_MESSAGES] == [
        {MESSAGE_ROLE: "user", MESSAGE_CONTENT: "What is the weather like in Boston?"},
        {
            MESSAGE_ROLE: "assistant",
            MESSAGE_CONTENT: None,
            MESSAGE_FUNCTION_CALL_NAME: "get_current_weather",
            MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON: '{"location": "Boston, MA"}',
        },
        {
            MESSAGE_ROLE: "function",
            MESSAGE_NAME: "get_current_weather",
            MESSAGE_CONTENT: '{"temperature": "22", "unit": "celsius", "description": "Sunny"}',
        },
    ]
    assert attributes[LLM_INVOCATION_PARAMETERS] == {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "functions": functions,
    }
    assert LLM_FUNCTION_CALL not in attributes
    assert span.events == []


def test_openai_instrumentor_exception() -> None:
    with patch.object(APIRequestor, "request_raw") as mocked_api_requestor_request_fn:
        model = "gpt-4"
        messages = [{"role": "user", "content": "Who won the World Cup in 2018?"}]
        temperature = 0.23
        tracer = Tracer()
        OpenAIInstrumentor(tracer).instrument()
        mocked_api_requestor_request_fn.side_effect = RateLimitError("error-message")
        with pytest.raises(RateLimitError):
            openai.ChatCompletion.create(model=model, messages=messages, temperature=temperature)

    spans = list(tracer.get_spans())
    assert len(spans) == 1
    span = spans[0]

    events = span.events
    assert len(events) == 1
    event = events[0]
    assert isinstance(event, SpanException)
    attributes = event.attributes
    assert attributes[EXCEPTION_TYPE] == "RateLimitError"
    assert attributes[EXCEPTION_MESSAGE] == "error-message"
    assert "Traceback" in attributes[EXCEPTION_STACKTRACE]
