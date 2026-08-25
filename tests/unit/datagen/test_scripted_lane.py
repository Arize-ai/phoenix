from pathlib import Path
from typing import Any

import pytest
from openai import OpenAI
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode

from scripts.datagen.generation import FailureMode, GenerationError, MatrixCell, ProfileDraw
from scripts.datagen.mock_openai_provider import (
    PlaybackProvider,
    create_chat_completion,
)
from scripts.datagen.model_backend import BackendCapabilities, ModelResult
from scripts.datagen.openai_chat_sessions import OpenAIPlainChatRecorder, SpanCaptureExporter
from scripts.datagen.scripted import (
    ConversationScript,
    ConversationTurn,
    build_model_request,
    generate_script,
)
from scripts.datagen.seed_mechanics import MaterializedSeedEnvironment


def test_scripted_script_replays_through_instrumented_openai_client() -> None:
    cell = _cell()
    request = build_model_request(cell, _environment())
    assert request.model == "model-exact"
    assert "Returns are accepted within 21 days." in request.prompt
    assert "The buyer is preparing for travel." in request.prompt
    assert "target_mode" not in request.prompt
    assert "seed_intensities" not in request.prompt
    schema = request.output_schema
    assert schema["properties"]["messages"]["minItems"] == 2
    assert schema["properties"]["messages"]["maxItems"] == 2
    assert schema["properties"]["messages"]["items"]["properties"] == {
        "role": {"type": "string", "enum": ["user", "assistant"]},
        "content": {"type": "string", "pattern": "\\S"},
    }

    script, _ = generate_script(
        _backend(
            _generated_conversation(
                "When will my order arrive?",
                "Standard delivery takes four to six business days.",
            )
        ),
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


@pytest.mark.parametrize("failure_mode", ["provider_429", "provider_timeout"])
def test_scripted_provider_fault_uses_native_sdk_retry(failure_mode: FailureMode) -> None:
    script = {
        "schema_version": 1,
        "cell_id": "b" * 64,
        "model": "model-exact",
        "failure_mode": failure_mode,
        "failure_turn": 0,
        "turns": [{"user": "Trigger the declared failure.", "assistant": "Recovered response."}],
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
            max_retries=1,
        )
        response = client.chat.completions.create(
            model="model-exact",
            messages=[{"role": "user", "content": "Trigger the declared failure."}],
        )
    finally:
        instrumentor.uninstrument()
        tracer_provider.shutdown()

    assert response.choices[0].message.content == "Recovered response."
    assert provider.request_count == 2
    assert [(event.mode, event.turn_index) for event in provider.failure_events] == [
        (failure_mode, 0)
    ]
    assert provider.turn_index == 1
    (span,) = exporter.get_finished_spans()
    assert span.status.status_code is StatusCode.OK


def test_scripted_malformed_response_retries_once_in_the_recorder(tmp_path: Path) -> None:
    cell = _cell(failure_mode="malformed_response", failure_turn=0)
    script = ConversationScript(
        cell_id=cell.cell_id,
        model=cell.assistant_model,
        failure_mode="malformed_response",
        failure_turn=0,
        turns=(ConversationTurn("Question", "Recovered response."),),
    )
    provider = PlaybackProvider(script.to_dict())
    exporter = SpanCaptureExporter()
    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    instrumentor = OpenAIInstrumentor()
    instrumentor.instrument(tracer_provider=tracer_provider)
    recorder = OpenAIPlainChatRecorder(
        OpenAI(
            api_key="test",
            base_url="http://datagen.test/v1",
            http_client=provider.http_client(),
            max_retries=0,
        ),
        exporter,
    )
    try:
        recorded = recorder.record_script(cell, script, tmp_path / "traces.jsonl")
    finally:
        instrumentor.uninstrument()
        tracer_provider.shutdown()

    assert recorded.messages[-1]["content"] == "Recovered response."
    assert provider.request_count == 2
    assert [(event.mode, event.turn_index) for event in provider.failure_events] == [
        ("malformed_response", 0)
    ]
    assert len(recorded.trace_ids) == 2
    assert len((tmp_path / "traces.jsonl").read_text().splitlines()) == 2


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


def test_structured_backend_generates_script_from_a_direct_result() -> None:
    script, result = generate_script(
        _backend(_generated_conversation("Question", "Answer")),
        _cell(failure_mode="malformed_response", failure_turn=0),
        _environment(),
    )

    assert script.turns[0].assistant == "Answer"
    assert script.failure_mode == "malformed_response"
    assert script.failure_turn == 0
    assert result.provider == "codex_exec"


def test_scripted_results_reject_internal_profile_language() -> None:
    cell = _cell(seed_intensities={"policy-window": 0.2})
    backend = _backend(_generated_conversation("Use policy-window.", "I can help."))

    with pytest.raises(GenerationError, match="exposed internal context"):
        generate_script(backend, cell, _environment())


def test_scripted_results_reject_bare_role_name_placeholders() -> None:
    backend = _backend(_generated_conversation("Please answer my question.", "System"))

    with pytest.raises(GenerationError, match="bare role-name placeholder"):
        generate_script(backend, _cell(), _environment())


def test_scripted_results_require_exact_role_alternation() -> None:
    backend = _backend(
        {
            "messages": [
                {"role": "assistant", "content": "I can help."},
                {"role": "user", "content": "Please answer my question."},
            ]
        }
    )

    with pytest.raises(GenerationError, match="message 0 must have role 'user'"):
        generate_script(backend, _cell(), _environment())


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


def _cell(
    seed_intensities: dict[str, float] | None = None,
    *,
    failure_mode: FailureMode = "none",
    failure_turn: int | None = None,
) -> MatrixCell:
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
            failure_mode=failure_mode,
            failure_turn=failure_turn,
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
