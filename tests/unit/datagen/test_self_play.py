import json
from base64 import b64encode
from dataclasses import replace
from pathlib import Path
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
from scripts.datagen import self_play as self_play_module
from scripts.datagen.fake_tools import InjectedToolFailure, load_default_fixture_sets
from scripts.datagen.generation import (
    GenerationRun,
    MatrixCell,
    RunConfig,
    expand_seed_matrix,
    matrix_sha256,
)
from scripts.datagen.mock_openai_provider import PlaybackProvider
from scripts.datagen.model_backend import BackendCapabilities, ModelResult
from scripts.datagen.profile import (
    ToolPatchOperation,
    ToolResultOverlay,
    load_profile_set,
)
from scripts.datagen.seed_mechanics import MaterializedSeedEnvironment
from scripts.datagen.self_play import (
    AssistantRequest,
    BackendUserSimulator,
    ModelRole,
    Persona,
    RecordedAssistantTurn,
    SelfPlayError,
    SelfPlayPlan,
    SimulatedUserMessage,
    TokenUsage,
    UserSimulationRequest,
    record_self_play_cell,
    self_play_plan_from_cell,
)


def test_profile_draw_builds_plan_and_structured_user_simulator(tmp_path: Path) -> None:
    _, cell = _run(tmp_path, self_play_target=1)
    cell = replace(
        cell,
        profile=replace(cell.profile, failure_mode="tool_delay", failure_turn=None),
    )

    class Backend:
        provider = "codex_exec"
        capabilities = BackendCapabilities()

        def __init__(self) -> None:
            self.request: Any = None

        def generate(self, request: object) -> ModelResult:
            self.request = request
            return ModelResult(
                provider=self.provider,
                model="gpt-5.6-luna",
                output={"content": "Can you explain the return window?"},
                usage=None,
            )

    role = ModelRole("user_simulator", "openai_api", "gpt-5.6-luna")
    environment = _environment(load_default_fixture_sets()["retail"])
    plan = self_play_plan_from_cell(
        cell,
        environment,
        simulator=role,
        assistant_provider="openai_api",
    )
    backend = Backend()
    message = BackendUserSimulator(backend).simulate(
        UserSimulationRequest(
            cell_id=cell.cell_id,
            turn_index=0,
            turn_count=plan.turn_count,
            scenario_template=plan.scenario_template,
            persona=plan.persona,
            register=plan.register,
            simulator_traits=plan.environment.simulator_traits,
            route_context=plan.environment.route_context,
            model=role.model,
            messages=(),
        )
    )

    assert plan.domain == cell.profile.domain
    assert plan.failure_mode == "tool_delay"
    assert plan.tool_failure_mode == "tool_delay"
    assert plan.checkpoint_identity()["environment_digest"] == "e" * 64
    assert "The buyer is preparing for travel." in backend.request.prompt
    assert "complete the return before departure" in backend.request.prompt
    assert "Do not answer the request as the assistant" in backend.request.prompt
    assert backend.request.output_schema["properties"]["content"] == {
        "type": "string",
        "pattern": "\\S",
    }
    assert message.content == "Can you explain the return window?"


def test_self_play_resumes_complete_turns_and_records_only_assistant_calls(
    tmp_path: Path,
) -> None:
    run, cell = _run(tmp_path, self_play_target=1)
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
    recorder = _OpenAIRecorder(client, exporter)
    kwargs = _record_kwargs(run, cell, simulator, recorder)

    try:
        with pytest.raises(_SimulatedInterruption):
            record_self_play_cell(**kwargs)
        attempt_dir = run.directory / "staging" / cell.cell_id / "attempt-1"
        assert not (attempt_dir / "fragment-candidate.json").exists()

        candidate = record_self_play_cell(**kwargs)
    finally:
        instrumentor.uninstrument()
        tracer_provider.shutdown()

    assert candidate.path.name == "fragment-candidate.json"
    validate_fragment_v2(candidate.fragment)
    assert candidate.fragment["turn_count"] == 2
    assert candidate.fragment["trace_ids"] == [
        f"{span.context.trace_id:032x}" for span in exporter.get_finished_spans()
    ]
    assert [model["role"] for model in candidate.fragment["models_used"]] == [
        "user_simulator",
        "assistant",
    ]
    assert [message["content"] for message in candidate.conversation["messages"]] == [
        "I need help understanding the return window.",
        "Unused items can be returned within 30 days.",
        "What should I include with the parcel?",
        "Include the prepaid label from the order page.",
    ]
    assert len(exporter.get_finished_spans()) == 2
    assert all("tools" in request and "tool_choice" not in request for request in playback.requests)
    assert candidate.path.with_name("traces.jsonl").is_file()
    assert json.loads(candidate.path.read_text())["engagement_signal"] == {
        "status": "complete",
        "cell_id": cell.cell_id,
        "engaged_seed_ids": ["deadline", "policy-window"],
    }
    checkpoints = [
        json.loads(line)
        for line in (run.directory / "attempts.jsonl").read_text().splitlines()
        if '"event":"checkpoint"' in line
    ]
    assert [event["data"]["completed_turns"] for event in checkpoints] == [1, 2]
    run.accept_cell(cell.cell_id, candidate.assistant_attempt_id, candidate.fragment)
    assert run.accepted_cell_ids == {cell.cell_id}


def test_repeated_trace_capture_restarts_both_roles_under_a_new_attempt(
    tmp_path: Path,
) -> None:
    run, cell = _run(tmp_path, self_play_target=2)
    recorder = _CollisionOnceRecorder()
    simulator = _StaticSimulator(
        ("Please check my order status.", "Has the carrier posted a delivery estimate?")
    )

    candidate = record_self_play_cell(**_record_kwargs(run, cell, simulator, recorder))

    assert candidate.assistant_attempt_id.endswith(":generation:2")
    assert candidate.simulator_attempt_id.endswith(":user_simulator:2")
    assert "attempt-2" in str(candidate.path)
    assert not (
        run.directory / "staging" / cell.cell_id / "attempt-1" / "fragment-candidate.json"
    ).exists()
    assert run.status()["attempts"]["self_play"] == 2
    assert candidate.fragment["trace_ids"] == ["2" * 32, "3" * 32]
    failures = [
        json.loads(line)
        for line in (run.directory / "attempts.jsonl").read_text().splitlines()
        if '"event":"failed"' in line
    ]
    assert len(failures) == 2


def test_self_play_rejects_internal_language_from_the_simulator(tmp_path: Path) -> None:
    run, cell = _run(tmp_path, self_play_target=1)

    with pytest.raises(SelfPlayError, match="exposed internal context"):
        record_self_play_cell(
            **_record_kwargs(
                run,
                cell,
                _StaticSimulator(("Discuss the targeted seed.",)),
                _CollisionOnceRecorder(),
                turn_count=1,
            )
        )


def test_self_play_rejects_bare_role_names_from_the_simulator() -> None:
    with pytest.raises(SelfPlayError, match="bare role-name placeholder"):
        SimulatedUserMessage(content="Tool")


def test_self_play_tools_receive_materialized_overlays(tmp_path: Path) -> None:
    run, cell = _run(tmp_path, self_play_target=1)
    recorder = _ToolCallingRecorder()

    record_self_play_cell(
        **_record_kwargs(
            run,
            cell,
            _StaticSimulator(("What does the return guidance say?",)),
            recorder,
            turn_count=1,
        )
    )

    assert recorder.result is not None
    assert recorder.result["documents"][0]["text"] == "Returns require a manual review."


def test_self_play_applies_tool_exception_only_to_the_first_invocation(tmp_path: Path) -> None:
    run, cell = _run(tmp_path, self_play_target=1)
    recorder = _RecoveringToolCallingRecorder()

    candidate = record_self_play_cell(
        **_record_kwargs(
            run,
            cell,
            _StaticSimulator(("What does the return guidance say?",)),
            recorder,
            turn_count=1,
            failure_mode="tool_exception",
        )
    )

    records = [
        json.loads(line)
        for line in candidate.path.with_name("tool-invocations.jsonl").read_text().splitlines()
    ]
    assert [record["outcome"] for record in records] == ["error", "success"]
    assert recorder.error_type is InjectedToolFailure
    assert candidate.fragment["failure_mode"] == "tool_exception"


def test_self_play_delays_only_the_first_tool_invocation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    run, cell = _run(tmp_path, self_play_target=1)
    recorder = _RecoveringToolCallingRecorder()
    delays: list[float] = []
    monkeypatch.setattr(self_play_module, "sleep", delays.append)

    candidate = record_self_play_cell(
        **_record_kwargs(
            run,
            cell,
            _StaticSimulator(("What does the return guidance say?",)),
            recorder,
            turn_count=1,
            failure_mode="tool_delay",
        )
    )

    records = [
        json.loads(line)
        for line in candidate.path.with_name("tool-invocations.jsonl").read_text().splitlines()
    ]
    assert [record["declared_delay_ms"] > 0 for record in records] == [True, False]
    assert delays == [records[0]["declared_delay_ms"] / 1000]


def test_self_play_rejects_an_unobserved_tool_fault(tmp_path: Path) -> None:
    run, cell = _run(tmp_path, self_play_target=1)

    with pytest.raises(SelfPlayError, match="tool_delay requires at least one tool invocation"):
        record_self_play_cell(
            **_record_kwargs(
                run,
                cell,
                _StaticSimulator(("Please summarize the return window.",)),
                _CollisionOnceRecorder(),
                turn_count=1,
                failure_mode="tool_delay",
            )
        )


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


class _CollisionOnceRecorder:
    def __init__(self) -> None:
        self.calls = 0

    def record(
        self,
        request: AssistantRequest,
        invoke_tool: Any,
    ) -> RecordedAssistantTurn:
        self.calls += 1
        trace_id = "1" * 32 if self.calls <= 2 else str(self.calls - 1) * 32
        request.traces_path.parent.mkdir(parents=True, exist_ok=True)
        with request.traces_path.open("a", encoding="utf-8") as output:
            output.write(
                json.dumps(
                    {
                        "resourceSpans": [
                            {
                                "scopeSpans": [
                                    {
                                        "spans": [
                                            {"traceId": b64encode(bytes.fromhex(trace_id)).decode()}
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                )
                + "\n"
            )
        return RecordedAssistantTurn(
            messages=({"role": "assistant", "content": "The order is in transit."},),
            trace_ids=(trace_id,),
            usage=TokenUsage(input_tokens=5, output_tokens=6),
        )


class _ToolCallingRecorder:
    def __init__(self) -> None:
        self.result: Any = None

    def record(self, request: AssistantRequest, invoke_tool: Any) -> RecordedAssistantTurn:
        self.result = invoke_tool("document_search", {"query": "return policy"})
        trace_id = "4" * 32
        request.traces_path.parent.mkdir(parents=True, exist_ok=True)
        with request.traces_path.open("a", encoding="utf-8") as output:
            output.write(
                json.dumps(
                    {
                        "resourceSpans": [
                            {
                                "scopeSpans": [
                                    {
                                        "spans": [
                                            {"traceId": b64encode(bytes.fromhex(trace_id)).decode()}
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                )
                + "\n"
            )
        return RecordedAssistantTurn(
            messages=({"role": "assistant", "content": "I found the return guidance."},),
            trace_ids=(trace_id,),
        )


class _RecoveringToolCallingRecorder(_ToolCallingRecorder):
    def __init__(self) -> None:
        super().__init__()
        self.error_type: type[Exception] | None = None

    def record(self, request: AssistantRequest, invoke_tool: Any) -> RecordedAssistantTurn:
        try:
            invoke_tool("document_search", {"query": "return policy"})
        except InjectedToolFailure as error:
            self.error_type = type(error)
        self.result = invoke_tool("document_search", {"query": "return policy"})
        return super().record(request, lambda name, arguments: self.result)


def _record_kwargs(
    run: GenerationRun,
    cell: MatrixCell,
    simulator: Any,
    recorder: Any,
    *,
    turn_count: int = 2,
    failure_mode: str = "none",
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
            failure_mode=failure_mode,
            turn_count=turn_count,
            simulator=ModelRole("user_simulator", "openai_api", "gpt-5.6-luna"),
            assistant_provider="openai_api",
            environment=_environment(load_default_fixture_sets()["retail"]),
            tool_failure_mode=failure_mode,
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


def _run(
    tmp_path: Path,
    *,
    self_play_target: int,
) -> tuple[GenerationRun, MatrixCell]:
    profile_dir = tmp_path / "customer_support" / "plain_chat"
    profile_dir.mkdir(parents=True, exist_ok=True)
    (profile_dir / "profile.json").write_text(
        json.dumps(
            {
                "schema_version": 1,
                "profile_id": "customer_support/plain_chat",
                "domain": "customer_support",
                "archetype": "plain_chat",
                "tool_surface": ["lookup_order"],
                "corpus_documents": [],
                "personas": [{"persona_id": "buyer", "instructions": "Ask for help.", "weight": 1}],
                "registers": [{"value": "neutral", "weight": 1}],
                "scenarios": [
                    {
                        "scenario_id": "return",
                        "topic": "returns",
                        "template": "Ask about returns.",
                        "weight": 1,
                        "target_seed_ids": [],
                    }
                ],
                "quality_tiers": [{"value": "high", "weight": 1}],
                "turn_counts": [{"value": 2, "weight": 1}],
                "adversarial_seeds": [],
            }
        )
    )
    manifest = tmp_path / "profile-set.json"
    manifest.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "profiles": ["customer_support/plain_chat/profile.json"],
                "sampling": {},
            }
        )
    )
    profiles = load_profile_set(manifest)
    cells = expand_seed_matrix(
        profiles,
        seed=3,
        luna_model="gpt-5.6-luna",
        frontier_model="gpt-5.6-luna",
        lane_targets={"self_play": self_play_target, "scripted": 1},
    )
    config = RunConfig(
        run_id="self-play-pass",
        matrix_seed=3,
        matrix_sha256=matrix_sha256(cells, 3, profiles.profile_set_sha256),
        luna_model="gpt-5.6-luna",
        frontier_model="gpt-5.6-luna",
        profile_set_sha256=profiles.profile_set_sha256,
        self_play_target=self_play_target,
        scripted_target=1,
    )
    run = GenerationRun.create_or_resume(
        tmp_path / "run", config=config, cells=cells, profiles=profiles
    )
    cell = next(cell for cell in cells if cell.lane == "self_play")
    return run, cell
