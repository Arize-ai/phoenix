from typing import Any

import pytest
from openai import OpenAI
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode

from scripts.datagen.generation import GenerationError, MatrixCell, ProfileDraw
from scripts.datagen.mock_openai_provider import PlaybackProvider, create_chat_completion
from scripts.datagen.model_backend import BackendCapabilities, ModelResult
from scripts.datagen.scripted import build_model_request, generate_script
from scripts.datagen.seed_mechanics import MaterializedSeedEnvironment


def test_scripted_script_replays_through_instrumented_openai_client() -> None:
    cell = _cell()
    request = build_model_request(cell, _environment())
    assert request.model == "model-exact"
    assert "target_mode" not in request.prompt
    assert "seed_intensities" not in request.prompt
    assert request.output_schema["properties"]["messages"]["minItems"] == 2
    script, _ = generate_script(
        _backend(_generated_conversation("When will my order arrive?", "Four to six days.")),
        cell,
        _environment(),
    )

    provider = PlaybackProvider(script.to_dict())
    exporter = InMemorySpanExporter()
    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    instrumentor = OpenAIInstrumentor()
    instrumentor.instrument(tracer_provider=tracer_provider)
    try:
        response = OpenAI(
            api_key="test",
            base_url="http://datagen.test/v1",
            http_client=provider.http_client(),
            max_retries=0,
        ).chat.completions.create(
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


def test_scripted_results_reject_internal_profile_language() -> None:
    cell = _cell(seed_intensities={"policy-window": 0.2})

    with pytest.raises(GenerationError, match="exposed internal context"):
        generate_script(
            _backend(_generated_conversation("Use policy-window.", "I can help.")),
            cell,
            _environment(),
        )


def _backend(output: dict[str, Any]) -> Any:
    class Backend:
        provider = "codex_exec"
        capabilities = BackendCapabilities()

        def generate(self, request: object) -> ModelResult:
            return ModelResult(
                provider=self.provider,
                model="model-exact",
                output=output,
                usage=None,
            )

    return Backend()


def _cell(seed_intensities: dict[str, float] | None = None) -> MatrixCell:
    return MatrixCell(
        cell_id="a" * 64,
        lane="scripted",
        ordinal=0,
        profile=ProfileDraw(
            profile_id="customer_support/plain_chat",
            domain="customer_support",
            archetype="plain_chat",
            scenario_id="return",
            topic="returns",
            scenario_template="Ask about a return.",
            persona_id="buyer",
            persona_instructions="Ask concise questions.",
            register="neutral",
            quality_tier="high",
            turn_count=1,
            target_mode="ambient",
            targeted_seed_id=None,
            seed_intensities=seed_intensities or {},
        ),
        assistant_model="model-exact",
    )


def _environment() -> MaterializedSeedEnvironment:
    return MaterializedSeedEnvironment(
        documents={"returns": "Returns are accepted within 21 days."},
        tool_fixture_data={"name": "support", "documents": [], "records": [], "statuses": []},
        tool_result_overlays=(),
        simulator_traits=("The buyer is preparing for travel.",),
        route_context="Ask whether the return can be completed before departure.",
        digest="e" * 64,
    )


def _generated_conversation(user: str, assistant: str) -> dict[str, Any]:
    return {
        "messages": [
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ]
    }
