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
    messages = [{"role": "user", "content": "What is the weather like in Boston?"}]
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
    openai.ChatCompletion.create(
        model=model, messages=messages, temperature=temperature, functions=functions
    )

    spans = list(tracer.get_spans())
    assert len(spans) == 1
    span = spans[0]
    attributes = span.attributes

    assert span.span_kind is SpanKind.LLM
    assert span.status_code == SpanStatusCode.OK
    assert attributes[LLM_INPUT_MESSAGES] == [
        {MESSAGE_ROLE: "user", MESSAGE_CONTENT: "What is the weather like in Boston?"}
    ]
    assert attributes[LLM_INVOCATION_PARAMETERS] == {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "functions": functions,
    }
    assert isinstance(attributes[LLM_FUNCTION_CALL], str)
    function_call_attributes = json.loads(attributes[LLM_FUNCTION_CALL])
    assert set(function_call_attributes.keys()) == {"name", "arguments"}
    assert function_call_attributes["name"] == "get_current_weather"
    function_call_arguments = json.loads(function_call_attributes["arguments"])
    assert function_call_arguments == {"location": "Boston"}
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
