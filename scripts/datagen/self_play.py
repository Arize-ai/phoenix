"""Checkpoint and stage persona-driven self-play conversations."""

from __future__ import annotations

import json
import os
from base64 import b64decode
from binascii import Error as Base64Error
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal, Protocol, cast

if TYPE_CHECKING or __package__:
    from scripts.datagen.fake_tools import (
        DEFAULT_REGISTRY,
        InvocationLedger,
        ToolContext,
        ToolRegistry,
    )
    from scripts.datagen.generation import (
        Attempt,
        GenerationError,
        GenerationRun,
        MatrixCell,
        PriceCatalog,
    )
    from scripts.datagen.model_backend import ModelBackend, ModelRequest
    from scripts.datagen.seed_mechanics import MaterializedSeedEnvironment
else:
    from fake_tools import DEFAULT_REGISTRY, InvocationLedger, ToolContext, ToolRegistry
    from generation import (
        Attempt,
        GenerationError,
        GenerationRun,
        MatrixCell,
        PriceCatalog,
    )
    from model_backend import ModelBackend, ModelRequest
    from seed_mechanics import MaterializedSeedEnvironment

AssistantMessage = Mapping[str, Any]
ToolInvoker = Callable[[str, Mapping[str, Any]], Mapping[str, Any]]
_RESERVED_TRANSCRIPT_PHRASES = (
    "adversarial seed",
    "seed intensity",
    "targeted seed",
    "make a mistake",
)


class SelfPlayError(GenerationError):
    """Raised when a self-play fragment cannot be recorded safely."""


class IncompleteTraceCapture(SelfPlayError):
    """Raised after an incomplete capture is closed as a failed attempt."""


@dataclass(frozen=True)
class TokenUsage:
    input_tokens: int = 0
    cached_input_tokens: int = 0
    output_tokens: int = 0

    def __post_init__(self) -> None:
        if min(self.input_tokens, self.cached_input_tokens, self.output_tokens) < 0:
            raise SelfPlayError("token usage cannot be negative")
        if self.cached_input_tokens > self.input_tokens:
            raise SelfPlayError("cached_input_tokens cannot exceed input_tokens")

    def __add__(self, other: TokenUsage) -> TokenUsage:
        return TokenUsage(
            input_tokens=self.input_tokens + other.input_tokens,
            cached_input_tokens=self.cached_input_tokens + other.cached_input_tokens,
            output_tokens=self.output_tokens + other.output_tokens,
        )

    def to_dict(self) -> dict[str, int]:
        return {
            "input_tokens": self.input_tokens,
            "cached_input_tokens": self.cached_input_tokens,
            "output_tokens": self.output_tokens,
        }

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> TokenUsage:
        fields = ("input_tokens", "cached_input_tokens", "output_tokens")
        if any(
            isinstance(value.get(field), bool) or not isinstance(value.get(field), int)
            for field in fields
        ):
            raise SelfPlayError("checkpoint token usage must contain integer counts")
        return cls(**{field: cast(int, value[field]) for field in fields})


@dataclass(frozen=True)
class ModelRole:
    role: Literal["user_simulator", "assistant"]
    provider: str
    model: str

    def __post_init__(self) -> None:
        if not self.provider or not self.model:
            raise SelfPlayError("model provider and model must be non-empty")

    def to_dict(self) -> dict[str, str]:
        return {"role": self.role, "provider": self.provider, "model": self.model}


@dataclass(frozen=True)
class Persona:
    name: str
    instructions: str

    def __post_init__(self) -> None:
        if not self.name or not self.instructions:
            raise SelfPlayError("persona name and instructions must be non-empty")


@dataclass(frozen=True)
class SelfPlayPlan:
    archetype: str
    domain: str
    topic: str
    scenario_template: str
    persona: Persona
    register: str
    quality_tier: str
    failure_mode: str
    turn_count: int
    simulator: ModelRole
    assistant_provider: str
    environment: MaterializedSeedEnvironment
    tool_failure_mode: str = "none"

    def __post_init__(self) -> None:
        if self.simulator.role != "user_simulator":
            raise SelfPlayError("simulator model role must be user_simulator")
        for name in (
            "archetype",
            "domain",
            "topic",
            "scenario_template",
            "register",
            "quality_tier",
            "failure_mode",
            "assistant_provider",
            "tool_failure_mode",
        ):
            if not getattr(self, name):
                raise SelfPlayError(f"{name} must be non-empty")
        if not 1 <= self.turn_count <= 16:
            raise SelfPlayError("self-play turn_count must be between 1 and 16")

    @property
    def length_band(self) -> str:
        if self.turn_count == 1:
            return "single_turn"
        if self.turn_count <= 3:
            return "short"
        if self.turn_count <= 7:
            return "medium"
        return "long"

    def checkpoint_identity(self) -> dict[str, Any]:
        return {
            "archetype": self.archetype,
            "domain": self.domain,
            "topic": self.topic,
            "scenario_template": self.scenario_template,
            "persona": self.persona.name,
            "persona_instructions": self.persona.instructions,
            "register": self.register,
            "quality_tier": self.quality_tier,
            "failure_mode": self.failure_mode,
            "turn_count": self.turn_count,
            "simulator": self.simulator.to_dict(),
            "assistant_provider": self.assistant_provider,
            "tool_failure_mode": self.tool_failure_mode,
            "environment_digest": self.environment.digest,
        }


def self_play_plan_from_cell(
    cell: MatrixCell,
    environment: MaterializedSeedEnvironment,
    *,
    simulator: ModelRole,
    assistant_provider: str,
    failure_mode: str = "none",
    tool_failure_mode: str = "none",
) -> SelfPlayPlan:
    if cell.lane != "self_play":
        raise SelfPlayError(f"cell {cell.cell_id} belongs to {cell.lane}, not self_play")
    draw = cell.profile
    return SelfPlayPlan(
        archetype=draw.archetype,
        domain=draw.domain,
        topic=draw.topic,
        scenario_template=draw.scenario_template,
        persona=Persona(draw.persona_id, draw.persona_instructions),
        register=draw.register,
        quality_tier=draw.quality_tier,
        failure_mode=failure_mode,
        turn_count=draw.turn_count,
        simulator=simulator,
        assistant_provider=assistant_provider,
        environment=environment,
        tool_failure_mode=tool_failure_mode,
    )


@dataclass(frozen=True)
class UserSimulationRequest:
    cell_id: str
    turn_index: int
    turn_count: int
    scenario_template: str
    persona: Persona
    register: str
    simulator_traits: tuple[str, ...]
    route_context: str | None
    model: str
    messages: tuple[AssistantMessage, ...]


@dataclass(frozen=True)
class SimulatedUserMessage:
    content: str
    usage: TokenUsage = TokenUsage()

    def __post_init__(self) -> None:
        if not self.content.strip():
            raise SelfPlayError("user simulator returned an empty message")
        if self.content.strip().casefold() in {"user", "assistant"}:
            raise SelfPlayError("user simulator returned a bare role-name placeholder")


class UserSimulator(Protocol):
    def simulate(self, request: UserSimulationRequest) -> SimulatedUserMessage: ...


class BackendUserSimulator:
    def __init__(self, backend: ModelBackend) -> None:
        self._backend = backend

    def simulate(self, request: UserSimulationRequest) -> SimulatedUserMessage:
        prompt = (
            f"Scenario: {request.scenario_template}\n"
            f"Persona: {request.persona.instructions}\n"
            f"Register: {request.register}\n"
            f"Character traits: {json.dumps(request.simulator_traits)}\n"
            f"Conversation goal: {request.route_context or 'Follow the scenario naturally.'}\n"
            f"Turn: {request.turn_index + 1}/{request.turn_count}\n"
            f"Conversation: {json.dumps(request.messages, sort_keys=True)}\n"
            "Write only the next message that this user would send. Do not answer the request "
            "as the assistant, and never use a bare role name such as 'user' or 'assistant' as "
            "message content."
        )
        result = self._backend.generate(
            ModelRequest(
                request_id=f"{request.cell_id}:user_simulator:{request.turn_index}",
                purpose="user_simulator",
                model=request.model,
                prompt=prompt,
                output_schema={
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["content"],
                    "properties": {"content": {"type": "string", "pattern": "\\S"}},
                },
                max_output_tokens=512,
            )
        )
        content = result.output.get("content")
        if not isinstance(content, str):
            raise SelfPlayError("user simulator result has no content string")
        usage = result.usage
        return SimulatedUserMessage(
            content,
            TokenUsage(
                input_tokens=usage.input_tokens if usage else 0,
                cached_input_tokens=usage.cached_input_tokens if usage else 0,
                output_tokens=usage.output_tokens if usage else 0,
            ),
        )


@dataclass(frozen=True)
class AssistantRequest:
    cell_id: str
    attempt_id: str
    turn_index: int
    model: str
    messages: tuple[AssistantMessage, ...]
    tools: tuple[Mapping[str, Any], ...]
    traces_path: Path


@dataclass(frozen=True)
class RecordedAssistantTurn:
    messages: tuple[AssistantMessage, ...]
    trace_ids: tuple[str, ...]
    usage: TokenUsage = TokenUsage()
    capture_complete: bool = True


class AssistantRecorder(Protocol):
    def record(
        self, request: AssistantRequest, invoke_tool: ToolInvoker
    ) -> RecordedAssistantTurn: ...


@dataclass(frozen=True)
class SelfPlayAttempts:
    assistant: Attempt
    simulator: Attempt

    def __post_init__(self) -> None:
        if self.assistant.cell_id != self.simulator.cell_id:
            raise SelfPlayError("assistant and simulator attempts must belong to the same cell")
        if self.assistant.purpose != "generation":
            raise SelfPlayError("assistant attempt purpose must be generation")
        if self.simulator.purpose != "user_simulator":
            raise SelfPlayError("simulator attempt purpose must be user_simulator")


@dataclass(frozen=True)
class StagedSelfPlayFragment:
    path: Path
    fragment: Mapping[str, Any]
    conversation: Mapping[str, Any]
    assistant_attempt_id: str
    simulator_attempt_id: str


def record_self_play_cell(
    run: GenerationRun,
    cell: MatrixCell,
    plan: SelfPlayPlan,
    *,
    simulator: UserSimulator,
    recorder: AssistantRecorder,
    prices: PriceCatalog | None,
    pass_seed: int,
    assistant_max_input_tokens: int,
    assistant_max_output_tokens: int,
    simulator_max_input_tokens: int,
    simulator_max_output_tokens: int,
    registry: ToolRegistry = DEFAULT_REGISTRY,
) -> StagedSelfPlayFragment:
    """Record one complete fragment, retrying incomplete trace captures as new attempts."""
    if cell.lane != "self_play":
        raise SelfPlayError(f"cell {cell.cell_id} belongs to {cell.lane}, not self_play")
    while True:
        attempts = _admit_attempts(
            run,
            cell,
            plan,
            prices=prices,
            assistant_max_input_tokens=assistant_max_input_tokens,
            assistant_max_output_tokens=assistant_max_output_tokens,
            simulator_max_input_tokens=simulator_max_input_tokens,
            simulator_max_output_tokens=simulator_max_output_tokens,
        )
        try:
            return _record_attempt(
                run,
                cell,
                attempts,
                plan,
                simulator=simulator,
                recorder=recorder,
                prices=prices,
                pass_seed=pass_seed,
                registry=registry,
            )
        except IncompleteTraceCapture:
            continue


def _admit_attempts(
    run: GenerationRun,
    cell: MatrixCell,
    plan: SelfPlayPlan,
    *,
    prices: PriceCatalog | None,
    assistant_max_input_tokens: int,
    assistant_max_output_tokens: int,
    simulator_max_input_tokens: int,
    simulator_max_output_tokens: int,
) -> SelfPlayAttempts:
    assistant = run.admitted_attempt(
        cell.cell_id,
        purpose="generation",
        model=cell.assistant_model,
        mode="direct",
        max_input_tokens=assistant_max_input_tokens,
        max_output_tokens=assistant_max_output_tokens,
        prices=prices,
        provider=plan.assistant_provider,
    )
    try:
        simulator = run.admitted_attempt(
            cell.cell_id,
            purpose="user_simulator",
            model=plan.simulator.model,
            mode="direct",
            max_input_tokens=simulator_max_input_tokens,
            max_output_tokens=simulator_max_output_tokens,
            prices=prices,
            provider=plan.simulator.provider,
        )
    except Exception:
        run.fail_attempt(assistant.attempt_id, "user simulator admission failed")
        raise
    return SelfPlayAttempts(assistant=assistant, simulator=simulator)


def _record_attempt(
    run: GenerationRun,
    cell: MatrixCell,
    attempts: SelfPlayAttempts,
    plan: SelfPlayPlan,
    *,
    simulator: UserSimulator,
    recorder: AssistantRecorder,
    prices: PriceCatalog | None,
    pass_seed: int,
    registry: ToolRegistry,
) -> StagedSelfPlayFragment:
    state = _load_checkpoint(run, cell, attempts, plan)
    messages = list(state["messages"])
    trace_ids = list(state["trace_ids"])
    assistant_usage = cast(TokenUsage, state["assistant_usage"])
    simulator_usage = cast(TokenUsage, state["simulator_usage"])
    tool_call_count = cast(int, state["tool_call_count"])
    completed_turns = cast(int, state["completed_turns"])
    attempt_dir = (
        run.directory / "staging" / cell.cell_id / f"attempt-{attempts.assistant.attempt_number}"
    )
    fixture_set, base_engagement_events = _fixture_set_for_environment(
        plan.environment,
        cell_id=cell.cell_id,
    )
    _write_immutable_json(
        attempt_dir / "engagement-base.json",
        {"schema_version": 1, "cell_id": cell.cell_id, "events": base_engagement_events},
    )
    ledger = InvocationLedger(attempt_dir / "tool-invocations.jsonl")

    for turn_index in range(completed_turns, plan.turn_count):
        user = simulator.simulate(
            UserSimulationRequest(
                cell_id=cell.cell_id,
                turn_index=turn_index,
                turn_count=plan.turn_count,
                scenario_template=plan.scenario_template,
                persona=plan.persona,
                register=plan.register,
                simulator_traits=plan.environment.simulator_traits,
                route_context=plan.environment.route_context,
                model=plan.simulator.model,
                messages=tuple(messages),
            )
        )
        _validate_generated_content(cell, user.content)
        simulator_usage += user.usage
        pending_messages = [*messages, {"role": "user", "content": user.content}]
        before_calls = tool_call_count

        def invoke_tool(name: str, arguments: Mapping[str, Any]) -> Mapping[str, Any]:
            nonlocal tool_call_count
            tool_call_count += 1
            context = ToolContext(
                pass_seed=pass_seed,
                cell_id=cell.cell_id,
                fixture_set=fixture_set,
                result_overlays=plan.environment.tool_result_overlays,
                failure_mode=plan.tool_failure_mode,
                call_ordinal=tool_call_count,
            )
            return registry.invoke(name, arguments, context, ledger)

        recorded = recorder.record(
            AssistantRequest(
                cell_id=cell.cell_id,
                attempt_id=attempts.assistant.attempt_id,
                turn_index=turn_index,
                model=cell.assistant_model,
                messages=tuple(_json_copy(message) for message in pending_messages),
                tools=tuple(cast(Mapping[str, Any], schema) for schema in registry.model_schemas()),
                traces_path=attempt_dir / "traces.jsonl",
            ),
            invoke_tool,
        )
        assistant_usage += recorded.usage
        repeated_trace_ids = set(trace_ids).intersection(recorded.trace_ids)
        try:
            _validate_recorded_turn(recorded)
            _validate_generated_content(cell, recorded.messages)
        except SelfPlayError as error:
            turn_error = str(error)
        else:
            turn_error = ""
        if not turn_error and not recorded.capture_complete:
            turn_error = "assistant recorder reported incomplete capture"
        if not turn_error and not _capture_contains(
            attempt_dir / "traces.jsonl", recorded.trace_ids
        ):
            turn_error = "assistant traces were not published to traces.jsonl"
        if not turn_error and repeated_trace_ids:
            turn_error = "assistant trace IDs repeat across turns"
        if turn_error:
            _fail_incomplete_attempts(
                run,
                attempts,
                prices,
                reason=turn_error,
                assistant_usage=assistant_usage,
                simulator_usage=simulator_usage,
            )
            raise IncompleteTraceCapture(
                f"self-play turn incomplete for {cell.cell_id} turn {turn_index}: "
                f"{turn_error}; "
                "the cell will restart under a new attempt"
            )
        messages = pending_messages + [_json_copy(message) for message in recorded.messages]
        trace_ids.extend(recorded.trace_ids)
        if tool_call_count < before_calls:
            raise SelfPlayError("tool call count moved backwards")
        checkpoint = _checkpoint(
            cell,
            attempts,
            plan,
            messages=messages,
            trace_ids=trace_ids,
            completed_turns=turn_index + 1,
            tool_call_count=tool_call_count,
            assistant_usage=assistant_usage,
            simulator_usage=simulator_usage,
        )
        run.checkpoint(attempts.assistant.attempt_id, checkpoint)

    published_trace_ids = _published_trace_ids(attempt_dir / "traces.jsonl")
    if set(published_trace_ids) != set(trace_ids):
        reason = "attempt traces.jsonl contains traces outside the complete conversation"
        _fail_incomplete_attempts(
            run,
            attempts,
            prices,
            reason=reason,
            assistant_usage=assistant_usage,
            simulator_usage=simulator_usage,
        )
        raise IncompleteTraceCapture(
            f"self-play capture incomplete for {cell.cell_id}: {reason}; "
            "the cell will restart under a new attempt"
        )
    candidate = _stage_candidate(
        attempt_dir,
        cell,
        attempts,
        plan,
        messages=messages,
        trace_ids=trace_ids,
        tool_call_count=tool_call_count,
        assistant_usage=assistant_usage,
        simulator_usage=simulator_usage,
        engaged_seed_ids=tuple(
            sorted(
                {str(event["seed_id"]) for event in base_engagement_events}
                | {seed_id for record in ledger.records for seed_id in record.engaged_seed_ids}
            )
        ),
    )
    run.complete_attempt(
        attempts.simulator.attempt_id,
        prices=prices,
        input_tokens=simulator_usage.input_tokens,
        cached_input_tokens=simulator_usage.cached_input_tokens,
        output_tokens=simulator_usage.output_tokens,
    )
    run.complete_attempt(
        attempts.assistant.attempt_id,
        prices=prices,
        input_tokens=assistant_usage.input_tokens,
        cached_input_tokens=assistant_usage.cached_input_tokens,
        output_tokens=assistant_usage.output_tokens,
    )
    return candidate


def _fail_incomplete_attempts(
    run: GenerationRun,
    attempts: SelfPlayAttempts,
    prices: PriceCatalog | None,
    *,
    reason: str,
    assistant_usage: TokenUsage,
    simulator_usage: TokenUsage,
) -> None:
    run.fail_attempt(
        attempts.simulator.attempt_id,
        reason,
        prices=prices,
        input_tokens=simulator_usage.input_tokens,
        cached_input_tokens=simulator_usage.cached_input_tokens,
        output_tokens=simulator_usage.output_tokens,
    )
    run.fail_attempt(
        attempts.assistant.attempt_id,
        reason,
        prices=prices,
        input_tokens=assistant_usage.input_tokens,
        cached_input_tokens=assistant_usage.cached_input_tokens,
        output_tokens=assistant_usage.output_tokens,
    )


def _checkpoint(
    cell: MatrixCell,
    attempts: SelfPlayAttempts,
    plan: SelfPlayPlan,
    *,
    messages: Sequence[AssistantMessage],
    trace_ids: Sequence[str],
    completed_turns: int,
    tool_call_count: int,
    assistant_usage: TokenUsage,
    simulator_usage: TokenUsage,
) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "kind": "self_play_complete_turn",
        "cell_id": cell.cell_id,
        "assistant_attempt_id": attempts.assistant.attempt_id,
        "simulator_attempt_id": attempts.simulator.attempt_id,
        "plan": plan.checkpoint_identity(),
        "completed_turns": completed_turns,
        "messages": [_json_copy(message) for message in messages],
        "trace_ids": list(trace_ids),
        "tool_call_count": tool_call_count,
        "assistant_usage": assistant_usage.to_dict(),
        "simulator_usage": simulator_usage.to_dict(),
    }


def _load_checkpoint(
    run: GenerationRun,
    cell: MatrixCell,
    attempts: SelfPlayAttempts,
    plan: SelfPlayPlan,
) -> dict[str, Any]:
    latest: Mapping[str, Any] | None = None
    for line in (run.directory / "attempts.jsonl").read_text(encoding="utf-8").splitlines():
        event = json.loads(line)
        if (
            event.get("event") == "checkpoint"
            and event.get("attempt_id") == attempts.assistant.attempt_id
            and isinstance(event.get("data"), Mapping)
            and event["data"].get("kind") == "self_play_complete_turn"
        ):
            latest = cast(Mapping[str, Any], event["data"])
    if latest is None:
        return {
            "completed_turns": 0,
            "messages": [],
            "trace_ids": [],
            "tool_call_count": 0,
            "assistant_usage": TokenUsage(),
            "simulator_usage": TokenUsage(),
        }
    expected = {
        "schema_version": 1,
        "kind": "self_play_complete_turn",
        "cell_id": cell.cell_id,
        "assistant_attempt_id": attempts.assistant.attempt_id,
        "simulator_attempt_id": attempts.simulator.attempt_id,
        "plan": plan.checkpoint_identity(),
    }
    if any(latest.get(key) != value for key, value in expected.items()):
        raise SelfPlayError(f"self-play checkpoint contract changed for {cell.cell_id}")
    messages = latest.get("messages")
    trace_ids = latest.get("trace_ids")
    completed_turns = latest.get("completed_turns")
    tool_call_count = latest.get("tool_call_count")
    if (
        not isinstance(messages, list)
        or not isinstance(trace_ids, list)
        or isinstance(completed_turns, bool)
        or not isinstance(completed_turns, int)
        or isinstance(tool_call_count, bool)
        or not isinstance(tool_call_count, int)
        or not 0 <= completed_turns <= plan.turn_count
        or not 0 <= tool_call_count <= 6
    ):
        raise SelfPlayError(f"invalid self-play checkpoint state for {cell.cell_id}")
    _validate_trace_ids(trace_ids)
    return {
        "completed_turns": completed_turns,
        "messages": [_json_copy(message) for message in messages],
        "trace_ids": list(trace_ids),
        "tool_call_count": tool_call_count,
        "assistant_usage": TokenUsage.from_dict(_require_mapping(latest, "assistant_usage")),
        "simulator_usage": TokenUsage.from_dict(_require_mapping(latest, "simulator_usage")),
    }


def _validate_recorded_turn(recorded: RecordedAssistantTurn) -> None:
    if not recorded.messages or recorded.messages[-1].get("role") != "assistant":
        raise SelfPlayError("a complete assistant turn must end with an assistant message")
    content = recorded.messages[-1].get("content")
    if not isinstance(content, str) or not content.strip():
        raise SelfPlayError("a complete assistant turn must end with non-empty content")
    if content.strip().casefold() in {"user", "assistant"}:
        raise SelfPlayError("assistant recorder returned a bare role-name placeholder")
    _validate_trace_ids(recorded.trace_ids)
    if not recorded.trace_ids:
        raise SelfPlayError("a complete assistant turn must contain a recorded trace")


def _fixture_set_for_environment(
    environment: MaterializedSeedEnvironment,
    *,
    cell_id: str,
) -> tuple[Mapping[str, Any], tuple[Mapping[str, str], ...]]:
    fixture_set = _json_copy(dict(environment.tool_fixture_data))
    if not isinstance(fixture_set, dict) or not isinstance(fixture_set.get("name"), str):
        raise SelfPlayError("materialized tool fixture data must contain a string name")
    documents = fixture_set.get("documents")
    if not isinstance(documents, list):
        raise SelfPlayError("materialized tool fixture data must contain a documents list")
    by_id = {
        document.get("id"): document
        for document in documents
        if isinstance(document, dict) and isinstance(document.get("id"), str)
    }
    for document_id, content in environment.documents.items():
        if document_id in by_id:
            by_id[document_id]["text"] = content
        else:
            documents.append({"id": document_id, "text": content})
    events = [
        {
            "kind": "document_served",
            "cell_id": cell_id,
            "document_id": document_id,
            "seed_id": seed_id,
        }
        for document_id, seed_ids in sorted(environment.document_seed_ids.items())
        for seed_id in seed_ids
    ]
    events.extend(
        {"kind": "trait_active", "cell_id": cell_id, "document_id": "", "seed_id": seed_id}
        for seed_id in environment.trait_seed_ids
    )
    return fixture_set, tuple(events)


def _validate_generated_content(cell: MatrixCell, value: Any) -> None:
    forbidden = (*_RESERVED_TRANSCRIPT_PHRASES, *cell.profile.seed_intensities)
    for content in _text_values(value):
        lowered = content.casefold()
        if any(term.casefold() in lowered for term in forbidden):
            raise SelfPlayError(
                f"generated transcript for cell {cell.cell_id!r} exposed internal context"
            )


def _text_values(value: Any) -> tuple[str, ...]:
    if isinstance(value, str):
        return (value,)
    if isinstance(value, Mapping):
        return tuple(content for item in value.values() for content in _text_values(item))
    if isinstance(value, (list, tuple)):
        return tuple(content for item in value for content in _text_values(item))
    return ()


def _validate_trace_ids(trace_ids: Sequence[Any]) -> None:
    if any(
        not isinstance(trace_id, str)
        or len(trace_id) != 32
        or any(character not in "0123456789abcdef" for character in trace_id)
        for trace_id in trace_ids
    ):
        raise SelfPlayError("trace IDs must be 32-character lowercase hexadecimal strings")
    if len(set(trace_ids)) != len(trace_ids):
        raise SelfPlayError("trace IDs must not contain duplicates")


def _stage_candidate(
    attempt_dir: Path,
    cell: MatrixCell,
    attempts: SelfPlayAttempts,
    plan: SelfPlayPlan,
    *,
    messages: Sequence[AssistantMessage],
    trace_ids: Sequence[str],
    tool_call_count: int,
    assistant_usage: TokenUsage,
    simulator_usage: TokenUsage,
    engaged_seed_ids: tuple[str, ...],
) -> StagedSelfPlayFragment:
    published_trace_ids = _published_trace_ids(attempt_dir / "traces.jsonl")
    if set(published_trace_ids) != set(trace_ids):
        raise SelfPlayError("staged trace IDs must match the attempt traces.jsonl output")
    models_used = [
        plan.simulator.to_dict(),
        ModelRole("assistant", plan.assistant_provider, cell.assistant_model).to_dict(),
    ]
    conversation_messages = [_json_copy(message) for message in messages]
    conversation = {
        "messages": conversation_messages,
        "tool_call_count": tool_call_count,
        "usage_by_role": {
            "user_simulator": simulator_usage.to_dict(),
            "assistant": assistant_usage.to_dict(),
        },
    }
    visible_messages = [
        message for message in conversation_messages if message.get("role") != "system"
    ]
    fragment = {
        "fragment_id": cell.cell_id,
        "archetype": plan.archetype,
        "domain": plan.domain,
        "topic": plan.topic,
        "scenario_template": plan.scenario_template,
        "persona": plan.persona.name,
        "register": plan.register,
        "quality_tier": plan.quality_tier,
        "failure_mode": plan.failure_mode,
        "length_band": plan.length_band,
        "lane": "self_play",
        "models_used": models_used,
        "turn_count": plan.turn_count,
        "trace_ids": list(trace_ids),
        "content_sha256": sha256(_canonical_bytes(visible_messages)).hexdigest(),
        "quality_results": {},
    }
    candidate = {
        "schema_version": 1,
        "assistant_attempt_id": attempts.assistant.attempt_id,
        "simulator_attempt_id": attempts.simulator.attempt_id,
        "fragment": fragment,
        "conversation": conversation,
        "engagement_signal": {
            "status": "complete",
            "cell_id": cell.cell_id,
            "engaged_seed_ids": list(engaged_seed_ids),
        },
    }
    path = attempt_dir / "fragment-candidate.json"
    _write_immutable_json(path, candidate)
    return StagedSelfPlayFragment(
        path=path,
        fragment=fragment,
        conversation=conversation,
        assistant_attempt_id=attempts.assistant.attempt_id,
        simulator_attempt_id=attempts.simulator.attempt_id,
    )


def _write_immutable_json(path: Path, value: Mapping[str, Any]) -> None:
    content = _canonical_bytes(value) + b"\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != content:
            raise SelfPlayError(f"staged self-play candidate changed: {path}")
        return
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    with os.fdopen(descriptor, "wb") as output:
        output.write(content)
        output.flush()
        os.fsync(output.fileno())


def _capture_contains(path: Path, trace_ids: Sequence[str]) -> bool:
    if not trace_ids:
        return False
    try:
        published = set(_published_trace_ids(path))
    except (OSError, json.JSONDecodeError, SelfPlayError):
        return False
    return set(trace_ids).issubset(published)


def _published_trace_ids(path: Path) -> tuple[str, ...]:
    trace_ids = []
    for line in path.read_text(encoding="utf-8").splitlines():
        payload = json.loads(line)
        if not isinstance(payload, Mapping):
            raise SelfPlayError(f"raw trace row in {path} must be an object")
        resource_rows = payload.get("resourceSpans", [])
        if not isinstance(resource_rows, list):
            raise SelfPlayError(f"resourceSpans in {path} must be an array")
        for resource_spans in resource_rows:
            if not isinstance(resource_spans, Mapping):
                raise SelfPlayError(f"resourceSpans entries in {path} must be objects")
            scope_rows = resource_spans.get("scopeSpans", [])
            if not isinstance(scope_rows, list):
                raise SelfPlayError(f"scopeSpans in {path} must be an array")
            for scope_spans in scope_rows:
                if not isinstance(scope_spans, Mapping):
                    raise SelfPlayError(f"scopeSpans entries in {path} must be objects")
                span_rows = scope_spans.get("spans", [])
                if not isinstance(span_rows, list):
                    raise SelfPlayError(f"spans in {path} must be an array")
                for span in span_rows:
                    if not isinstance(span, Mapping):
                        raise SelfPlayError(f"span entries in {path} must be objects")
                    trace_id = span.get("traceId")
                    if not isinstance(trace_id, str):
                        continue
                    try:
                        trace_id_bytes = b64decode(trace_id, validate=True)
                    except Base64Error as error:
                        raise SelfPlayError(f"raw trace ID in {path} is not base64") from error
                    if len(trace_id_bytes) != 16:
                        raise SelfPlayError(f"raw trace ID in {path} is not 16 bytes")
                    trace_id_hex = trace_id_bytes.hex()
                    if trace_id_hex not in trace_ids:
                        trace_ids.append(trace_id_hex)
    _validate_trace_ids(trace_ids)
    return tuple(trace_ids)


def _require_mapping(value: Mapping[str, Any], field: str) -> Mapping[str, Any]:
    item = value.get(field)
    if not isinstance(item, Mapping):
        raise SelfPlayError(f"checkpoint {field} must be an object")
    return item


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def _json_copy(value: Any) -> Any:
    return json.loads(_canonical_bytes(value))
