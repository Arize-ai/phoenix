import json
from typing import Any

import pytest
from openai import OpenAI, RateLimitError
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode

from scripts.datagen.generation import MatrixCell
from scripts.datagen.mock_openai_provider import PlaybackProvider, create_chat_completion
from scripts.datagen.openai_batch import BatchResult
from scripts.datagen.scripted import build_script_request, scripts_from_batch_results


def test_scripted_batch_result_replays_through_instrumented_openai_client() -> None:
    cell = _cell()
    request = build_script_request("run-1", cell)
    assert request.custom_id == f"run-1:{cell.cell_id}:script"
    assert request.body["model"] == "model-exact"

    result = BatchResult(
        custom_id=request.custom_id,
        response_status_code=200,
        request_id="batch-request-1",
        body=_responses_body(
            {
                "turns": [
                    {
                        "user": "When will my order arrive?",
                        "assistant": "Standard delivery takes four to six business days.",
                    }
                ]
            }
        ),
        error=None,
    )
    (script,) = scripts_from_batch_results("run-1", [cell], [result])

    provider = PlaybackProvider(script.to_dict())
    exporter = InMemorySpanExporter()
    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    instrumentor = OpenAIInstrumentor()
    instrumentor.instrument(tracer_provider=tracer_provider)
    try:
        client = OpenAI(
            api_key="test",
            base_url="http://datagen.test/v1",
            http_client=provider.http_client(),
            max_retries=0,
        )
        response = client.chat.completions.create(
            model=script.model,
            messages=[{"role": "user", "content": script.turns[0].user}],
        )
    finally:
        instrumentor.uninstrument()
        tracer_provider.shutdown()

    assert response.choices[0].message.content == script.turns[0].assistant
    assert provider.turn_index == 1
    (span,) = exporter.get_finished_spans()
    assert span.status.status_code is StatusCode.OK


def test_scripted_rate_limit_uses_real_sdk_and_instrumenter_error_path() -> None:
    script = {
        "schema_version": 1,
        "cell_id": "b" * 64,
        "model": "model-exact",
        "failure_mode": "provider_429",
        "failure_turn": 0,
        "turns": [{"user": "Trigger the declared failure.", "assistant": "unused"}],
    }
    provider = PlaybackProvider(script)
    exporter = InMemorySpanExporter()
    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    instrumentor = OpenAIInstrumentor()
    instrumentor.instrument(tracer_provider=tracer_provider)
    try:
        client = OpenAI(
            api_key="test",
            base_url="http://datagen.test/v1",
            http_client=provider.http_client(),
            max_retries=0,
        )
        with pytest.raises(RateLimitError, match="scripted rate limit"):
            client.chat.completions.create(
                model="model-exact",
                messages=[{"role": "user", "content": "Trigger the declared failure."}],
            )
    finally:
        instrumentor.uninstrument()
        tracer_provider.shutdown()

    assert provider.turn_index == 0
    (span,) = exporter.get_finished_spans()
    assert span.status.status_code is StatusCode.ERROR
    assert any(event.name == "exception" for event in span.events)


def test_compatibility_provider_is_request_deterministic() -> None:
    request = {
        "model": "model-exact",
        "messages": [{"role": "user", "content": "When will my order arrive in 10001?"}],
        "tools": [
            {
                "type": "function",
                "function": {"name": "estimate_delivery_days", "parameters": {}},
            }
        ],
    }

    assert create_chat_completion(request) == create_chat_completion(request)


def _cell() -> MatrixCell:
    return MatrixCell(
        cell_id="a" * 64,
        lane="scripted",
        ordinal=0,
        factors={"archetype": "plain_chat", "failure_mode": "none"},
        assistant_model="model-exact",
    )


def _responses_body(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "output": [
            {
                "type": "message",
                "content": [{"type": "output_text", "text": json.dumps(value)}],
            }
        ]
    }
