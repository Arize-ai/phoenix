import json
from typing import Any, cast

import pytest
from google.protobuf.json_format import MessageToJson
from openai import OpenAI
from openinference.instrumentation import using_session
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from phoenix.datagen.schema import validate_fragment_v2
from scripts.datagen.fake_tools import load_default_fixture_sets
from scripts.datagen.generation import GenerationRun, MatrixCell
from scripts.datagen.mock_openai_provider import PlaybackProvider
from scripts.datagen.profile import ToolPatchOperation, ToolResultOverlay
from scripts.datagen.seed_mechanics import MaterializedSeedEnvironment
from scripts.datagen.self_play import (
    AssistantRequest,
    ModelRole,
    Persona,
    RecordedAssistantTurn,
    SelfPlayPlan,
    SimulatedUserMessage,
    TokenUsage,
    UserSimulationRequest,
    record_self_play_cell,
)


def test_self_play_resumes_complete_turns_and_records_only_assistant_calls(
    generation_run: GenerationRun,
) -> None:
    run = generation_run
    cell = next(cell for cell in run.cells if cell.lane == "self_play")
    playback = _CapturingPlaybackProvider(
        {
            "cell_id": cell.cell_id,
            "failure_mode": "none",
            "failure_turn": None,
            "turns": [
                {
                    "user": "I need help understanding the return window.",
                    "assistant": "Unused items can be returned within 30 days.",
                },
                {
                    "user": "What should I include with the parcel?",
                    "assistant": "Include the prepaid label from the order page.",
                },
            ],
        }
    )
    exporter = InMemorySpanExporter()
    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    instrumentor = OpenAIInstrumentor()
    instrumentor.instrument(tracer_provider=tracer_provider)
    client = OpenAI(
        api_key="test",
        base_url="http://datagen.test/v1",
        http_client=playback.http_client(),
        max_retries=0,
    )
    simulator = _InterruptOnceSimulator(
        (
            "I need help understanding the return window.",
            "What should I include with the parcel?",
        )
    )
    kwargs = _record_kwargs(run, cell, simulator, _OpenAIRecorder(client, exporter))

    try:
        with pytest.raises(_SimulatedInterruption):
            record_self_play_cell(**kwargs)
        attempt_dir = run.directory / "staging" / cell.cell_id / "attempt-1"
        assert not (attempt_dir / "fragment-candidate.json").exists()
        candidate = record_self_play_cell(**kwargs)
    finally:
        instrumentor.uninstrument()
        tracer_provider.shutdown()

    validate_fragment_v2(candidate.fragment)
    assert candidate.fragment["turn_count"] == 2
    assert len(exporter.get_finished_spans()) == 2
    assert [message["content"] for message in candidate.conversation["messages"]] == [
        "I need help understanding the return window.",
        "Unused items can be returned within 30 days.",
        "What should I include with the parcel?",
        "Include the prepaid label from the order page.",
    ]
    model_projection = json.dumps(playback.requests, sort_keys=True)
    assert "source_seed_id" not in model_projection
    assert "target_mode" not in model_projection
    assert "policy-window" not in model_projection
    checkpoints = [
        json.loads(line)
        for line in (run.directory / "attempts.jsonl").read_text().splitlines()
        if '"event":"checkpoint"' in line
    ]
    assert [event["data"]["completed_turns"] for event in checkpoints] == [1, 2]
    run.accept_cell(cell.cell_id, candidate.assistant_attempt_id, candidate.fragment)
    assert run.accepted_cell_ids == {cell.cell_id}


class _SimulatedInterruption(RuntimeError):
    pass


class _StaticSimulator:
    def __init__(self, messages: tuple[str, ...]) -> None:
        self.messages = messages

    def simulate(self, request: UserSimulationRequest) -> SimulatedUserMessage:
        return SimulatedUserMessage(
            self.messages[request.turn_index],
            TokenUsage(input_tokens=3, output_tokens=4),
        )


class _InterruptOnceSimulator(_StaticSimulator):
    def __init__(self, messages: tuple[str, ...]) -> None:
        super().__init__(messages)
        self.interrupted = False

    def simulate(self, request: UserSimulationRequest) -> SimulatedUserMessage:
        if request.turn_index == 1 and not self.interrupted:
            self.interrupted = True
            raise _SimulatedInterruption
        return super().simulate(request)


class _CapturingPlaybackProvider(PlaybackProvider):
    def __init__(self, script: dict[str, Any]) -> None:
        super().__init__(script)
        self.requests: list[dict[str, Any]] = []

    def _handle_http_request(self, request: Any) -> Any:
        self.requests.append(json.loads(request.content))
        return super()._handle_http_request(request)


class _OpenAIRecorder:
    def __init__(self, client: OpenAI, exporter: InMemorySpanExporter) -> None:
        self.client = client
        self.exporter = exporter

    def record(
        self,
        request: AssistantRequest,
        invoke_tool: Any,
    ) -> RecordedAssistantTurn:
        before = len(self.exporter.get_finished_spans())
        with using_session(request.cell_id):
            response = self.client.chat.completions.create(
                model=request.model,
                messages=cast(Any, list(request.messages)),
                tools=cast(Any, list(request.tools)),
            )
        spans = self.exporter.get_finished_spans()[before:]
        request.traces_path.parent.mkdir(parents=True, exist_ok=True)
        with request.traces_path.open("a", encoding="utf-8") as output:
            output.write(MessageToJson(encode_spans(spans), indent=None) + "\n")
        usage = response.usage
        assert usage is not None
        message = response.choices[0].message.model_dump(mode="json", exclude_none=True)
        return RecordedAssistantTurn(
            messages=(message,),
            trace_ids=tuple(dict.fromkeys(f"{span.context.trace_id:032x}" for span in spans)),
            usage=TokenUsage(
                input_tokens=usage.prompt_tokens,
                cached_input_tokens=(usage.prompt_tokens_details.cached_tokens or 0)
                if usage.prompt_tokens_details
                else 0,
                output_tokens=usage.completion_tokens,
            ),
        )


def _record_kwargs(
    run: GenerationRun,
    cell: MatrixCell,
    simulator: Any,
    recorder: Any,
) -> dict[str, Any]:
    return {
        "run": run,
        "cell": cell,
        "plan": SelfPlayPlan(
            archetype="plain_chat",
            domain="retail",
            topic="returns",
            scenario_template="support_chat",
            persona=Persona("careful shopper", "Ask concise follow-up questions."),
            register="friendly",
            quality_tier="high",
            failure_mode="none",
            turn_count=2,
            simulator=ModelRole("user_simulator", "openai_api", "gpt-5.6-luna"),
            assistant_provider="openai_api",
            environment=_environment(load_default_fixture_sets()["retail"]),
            tool_failure_mode="none",
        ),
        "simulator": simulator,
        "recorder": recorder,
        "pass_seed": 17,
        "assistant_max_input_tokens": 2_000,
        "assistant_max_output_tokens": 2_000,
        "simulator_max_input_tokens": 2_000,
        "simulator_max_output_tokens": 2_000,
    }


def _environment(fixture_set: Any) -> MaterializedSeedEnvironment:
    return MaterializedSeedEnvironment(
        documents={"doc-returns": "Unused items can be returned within 21 days."},
        tool_fixture_data=fixture_set,
        tool_result_overlays=(
            ToolResultOverlay(
                "document_search",
                {"query": "return policy"},
                (
                    ToolPatchOperation(
                        "replace", "/documents/0/text", "Returns require a manual review."
                    ),
                ),
            ),
        ),
        simulator_traits=("The buyer is preparing for travel.",),
        route_context="Ask whether the store can complete the return before departure.",
        digest="e" * 64,
        document_seed_ids={"doc-returns": ("policy-window",)},
        trait_seed_ids=("deadline",),
    )
