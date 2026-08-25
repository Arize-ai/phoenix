import json
from pathlib import Path
from typing import Any

import httpx
from openai import OpenAI
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import StatusCode

from scripts.datagen.openai_chat_sessions import SpanCaptureExporter
from scripts.datagen.structured_extraction import (
    ExtractionRequest,
    StructuredExtractionRecorder,
)


def test_structured_extraction_records_function_result(
    tmp_path: Path,
) -> None:
    provider = _ExtractionProvider()
    exporter = SpanCaptureExporter()
    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    instrumentor = OpenAIInstrumentor()
    instrumentor.instrument(tracer_provider=tracer_provider)
    recorder = StructuredExtractionRecorder(
        OpenAI(
            api_key="test",
            base_url="http://datagen.test/v1",
            http_client=provider.http_client(),
            max_retries=0,
        ),
        exporter,
    )
    try:
        case = recorder.record(
            ExtractionRequest(
                cell_id="a" * 64,
                model="model-exact",
                text="Order A-42 is late and I need it today.",
                traces_path=tmp_path / "accepted.jsonl",
            )
        )
    finally:
        instrumentor.uninstrument()
        tracer_provider.shutdown()

    assert (case.order_id, case.intent, case.urgent) == ("A-42", "delivery", True)
    assert len(case.trace_ids) == 1
    request = provider.requests[0]
    assert request["model"] == "model-exact"
    assert request["tool_choice"]["function"]["name"] == "extract_support_case"
    assert request["tools"][0]["function"]["strict"] is True
    spans = exporter.spans_since(0)
    assert len(spans) == 1
    assert spans[0].attributes["session.id"] == "a" * 64
    assert spans[0].status.status_code is StatusCode.OK
    assert (tmp_path / "accepted.jsonl").is_file()


class _ExtractionProvider:
    def __init__(self) -> None:
        self.requests: list[dict[str, Any]] = []

    def http_client(self) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self._handle))

    def _handle(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.requests.append(body)
        return httpx.Response(
            200,
            json={
                "id": "chatcmpl-extraction",
                "object": "chat.completion",
                "created": 0,
                "model": body["model"],
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [
                                {
                                    "id": "call-extract",
                                    "type": "function",
                                    "function": {
                                        "name": "extract_support_case",
                                        "arguments": json.dumps(
                                            {
                                                "order_id": "A-42",
                                                "intent": "delivery",
                                                "urgent": True,
                                            },
                                            separators=(",", ":"),
                                        ),
                                    },
                                }
                            ],
                        },
                        "finish_reason": "tool_calls",
                    }
                ],
                "usage": {
                    "prompt_tokens": 16,
                    "completion_tokens": 8,
                    "total_tokens": 24,
                },
            },
            request=request,
        )
