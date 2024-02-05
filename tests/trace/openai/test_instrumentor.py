import sys
from importlib import reload
from types import ModuleType
from typing import AsyncIterator, Iterator

import openai
import pytest
from httpx import AsyncByteStream, Response
from openai import OpenAI
from opentelemetry.sdk.trace import ReadableSpan, SpanProcessor
from phoenix.trace.openai.instrumentor import OpenAIInstrumentor
from phoenix.trace.tracer import Tracer
from respx import MockRouter


class MockAsyncByteStream(AsyncByteStream):
    def __init__(self, byte_stream: Iterator[bytes]):
        self._byte_stream = byte_stream

    async def __aiter__(self) -> AsyncIterator[bytes]:
        for byte_string in self._byte_stream:
            yield byte_string


@pytest.fixture
def openai_module() -> ModuleType:
    """
    Reloads openai module to reset patched class. Both the top-level module and
    the sub-module containing the patched client class must be reloaded.
    """
    # Cannot be reloaded with reload(openai._client) due to a naming conflict with a variable.
    reload(sys.modules["openai._client"])
    return reload(openai)


@pytest.fixture
def sync_client(openai_api_key: str, openai_module: ModuleType) -> OpenAI:
    """
    Instantiates the OpenAI synchronous client using the reloaded openai module,
    which is necessary when running multiple tests at once due to the patch
    applied by the OpenAIInstrumentor.
    """
    return openai_module.OpenAI(api_key=openai_api_key)


@pytest.fixture
def async_client(openai_api_key: str, openai_module: ModuleType) -> OpenAI:
    """
    Instantiates the OpenAI asynchronous client using the reloaded openai
    module, which is necessary when running multiple tests at once due to the
    patch applied by the OpenAIInstrumentor.
    """
    return openai_module.AsyncOpenAI(api_key=openai_api_key)


class InMemorySpanProcessor(SpanProcessor):
    def __init__(self):
        self.spans = []

    def on_end(self, span: ReadableSpan):
        self.spans.append(span)

    def get_spans(self):
        return self.spans


def test_openai_instrumentor_instruments_chat_completion(
    sync_client: OpenAI,
    respx_mock: MockRouter,
) -> None:
    span_processor = InMemorySpanProcessor()
    tracer = Tracer()
    instrumentor = OpenAIInstrumentor(tracer)
    instrumentor.tracer._tracer_provider.add_span_processor(span_processor)
    instrumentor.instrument()
    model = "gpt-4"
    messages = [{"role": "user", "content": "Who won the World Cup in 2018?"}]
    temperature = 0.23
    expected_response_text = "France won the World Cup in 2018."
    respx_mock.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=Response(
            status_code=200,
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
    response = sync_client.chat.completions.create(
        model=model, messages=messages, temperature=temperature
    )
    response_text = response.choices[0].message.content

    assert response_text == expected_response_text

    spans = span_processor.get_spans()
    assert len(spans) == 1
