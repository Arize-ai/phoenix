#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "openai==3.2.0",
# ]
# ///
"""Build and decode Batch requests for scripted datagen conversations."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Literal, Mapping, Sequence, cast

if TYPE_CHECKING or __package__:
    from scripts.datagen.generation import GenerationError, MatrixCell
    from scripts.datagen.model_backend import ModelBackend, ModelRequest, ModelResult
    from scripts.datagen.openai_batch import BatchRequest, BatchResult, custom_id
    from scripts.datagen.seed_mechanics import MaterializedSeedEnvironment
else:
    from generation import GenerationError, MatrixCell
    from model_backend import ModelBackend, ModelRequest, ModelResult
    from openai_batch import (
        BatchRequest,
        BatchResult,
        custom_id,
    )
    from seed_mechanics import MaterializedSeedEnvironment

SCRIPT_SCHEMA_VERSION = 1
FailureMode = Literal[
    "none",
    "provider_429",
    "provider_timeout",
    "malformed_response",
    "tool_exception",
]
FAILURE_MODES: frozenset[str] = frozenset(
    {"none", "provider_429", "provider_timeout", "malformed_response", "tool_exception"}
)
_RESERVED_TRANSCRIPT_PHRASES = (
    "adversarial seed",
    "seed intensity",
    "targeted seed",
    "make a mistake",
)

_SCRIPT_OUTPUT_SCHEMA: Mapping[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["messages"],
    "properties": {
        "messages": {
            "type": "array",
            "minItems": 2,
            "maxItems": 32,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["role", "content"],
                "properties": {
                    "role": {"type": "string", "enum": ["user", "assistant"]},
                    "content": {"type": "string", "pattern": "\\S"},
                },
            },
        }
    },
}


@dataclass(frozen=True)
class ConversationTurn:
    user: str
    assistant: str

    def to_dict(self) -> dict[str, str]:
        return {"user": self.user, "assistant": self.assistant}


@dataclass(frozen=True)
class ConversationScript:
    cell_id: str
    model: str
    failure_mode: FailureMode
    failure_turn: int | None
    turns: tuple[ConversationTurn, ...]
    schema_version: int = SCRIPT_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if not self.cell_id or not self.model:
            raise GenerationError("Conversation script cell_id and model must be non-empty")
        if self.failure_mode not in FAILURE_MODES:
            raise GenerationError(f"Unsupported scripted failure mode {self.failure_mode!r}")
        if not self.turns or len(self.turns) > 16:
            raise GenerationError("Conversation script must contain 1 to 16 turns")
        if any(not turn.user.strip() or not turn.assistant.strip() for turn in self.turns):
            raise GenerationError("Conversation script messages must be non-empty")
        if self.failure_mode == "none" and self.failure_turn is not None:
            raise GenerationError("Successful conversation scripts cannot name a failure turn")
        if self.failure_mode != "none" and (
            self.failure_turn is None or not 0 <= self.failure_turn < len(self.turns)
        ):
            raise GenerationError("Scripted failure turn must identify an existing turn")

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "cell_id": self.cell_id,
            "model": self.model,
            "failure_mode": self.failure_mode,
            "failure_turn": self.failure_turn,
            "turns": [turn.to_dict() for turn in self.turns],
        }

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> ConversationScript:
        if value.get("schema_version") != SCRIPT_SCHEMA_VERSION:
            raise GenerationError("Unsupported conversation script schema_version")
        raw_turns = value.get("turns")
        if not isinstance(raw_turns, list):
            raise GenerationError("Conversation script turns must be an array")
        turns = tuple(_parse_turn(turn, index) for index, turn in enumerate(raw_turns))
        failure_mode = _failure_mode(value.get("failure_mode", "none"))
        failure_turn = value.get("failure_turn")
        if failure_turn is not None and not isinstance(failure_turn, int):
            raise GenerationError("Conversation script failure_turn must be an integer or null")
        cell_id = value.get("cell_id")
        model = value.get("model")
        if not isinstance(cell_id, str) or not isinstance(model, str):
            raise GenerationError("Conversation script cell_id and model must be strings")
        return cls(
            cell_id=cell_id,
            model=model,
            failure_mode=failure_mode,
            failure_turn=failure_turn,
            turns=turns,
        )


def build_model_request(cell: MatrixCell, environment: MaterializedSeedEnvironment) -> ModelRequest:
    if cell.lane != "scripted":
        raise GenerationError(f"Cell {cell.cell_id} belongs to {cell.lane}, not scripted")
    context = {
        "scenario": cell.profile.scenario_template,
        "topic": cell.profile.topic,
        "persona": cell.profile.persona_instructions,
        "register": cell.profile.register,
        "turn_count": cell.profile.turn_count,
        "application": environment.visible_dict(),
    }
    visible_context = json.dumps(context, sort_keys=True, separators=(",", ":"))
    message_count = cell.profile.turn_count * 2
    messages_schema = cast(Mapping[str, Any], _SCRIPT_OUTPUT_SCHEMA["properties"])["messages"]
    output_schema = {
        **_SCRIPT_OUTPUT_SCHEMA,
        "properties": {
            "messages": {
                **cast(Mapping[str, Any], messages_schema),
                "minItems": message_count,
                "maxItems": message_count,
            }
        },
    }
    prompt = (
        "Write one coherent whole conversation for an offline telemetry fixture. "
        "Return only the requested JSON object with messages in chronological order. "
        f"Write exactly {cell.profile.turn_count} user/assistant exchanges. The first message "
        "must have role 'user' and contain the user's request or follow-up in the persona's "
        "voice. Each immediately following message must have role 'assistant' and directly "
        "answer that user message. Alternate user and assistant exactly. Never put a role name "
        "such as 'user' or 'assistant' in the content field as a placeholder. Use this "
        f"ordinary application context: {visible_context}"
    )
    return ModelRequest(
        request_id=cell.cell_id,
        purpose="generation",
        model=cell.assistant_model,
        prompt=prompt,
        output_schema=output_schema,
        max_output_tokens=max(512, cell.profile.turn_count * 512),
    )


def generate_script(
    backend: ModelBackend,
    cell: MatrixCell,
    environment: MaterializedSeedEnvironment,
) -> tuple[ConversationScript, ModelResult]:
    result = backend.generate(build_model_request(cell, environment))
    return _script_from_output(cell, result.output), result


def build_script_request(
    run_id: str, cell: MatrixCell, environment: MaterializedSeedEnvironment
) -> BatchRequest:
    """Build one Responses Batch row for a scripted matrix cell."""
    request = build_model_request(cell, environment)
    return BatchRequest(
        custom_id=custom_id(run_id, cell.cell_id, "script"),
        body={
            "model": request.model,
            "input": request.prompt,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "conversation_script",
                    "strict": True,
                    "schema": request.output_schema,
                }
            },
        },
    )


def scripts_from_batch_results(
    run_id: str,
    cells: Sequence[MatrixCell],
    results: Sequence[BatchResult],
) -> tuple[ConversationScript, ...]:
    """Correlate terminal Batch rows and decode one script per matrix cell."""
    expected = {custom_id(run_id, cell.cell_id, "script"): cell for cell in cells}
    received = {result.custom_id: result for result in results}
    if len(received) != len(results):
        raise GenerationError("Script Batch results contain duplicate custom_id values")
    unknown = sorted(received.keys() - expected.keys())
    missing = sorted(expected.keys() - received.keys())
    if unknown or missing:
        raise GenerationError(
            f"Script Batch result mismatch: missing={missing!r}, unknown={unknown!r}"
        )
    return tuple(
        _script_from_result(expected[identifier], received[identifier]) for identifier in expected
    )


def _script_from_result(cell: MatrixCell, result: BatchResult) -> ConversationScript:
    if not result.succeeded or result.body is None:
        raise GenerationError(f"Script Batch request {result.custom_id!r} failed: {result.error!r}")
    output_text = _response_output_text(result.body)
    try:
        value = json.loads(output_text)
    except json.JSONDecodeError as error:
        raise GenerationError(
            f"Script Batch request {result.custom_id!r} returned invalid JSON"
        ) from error
    if not isinstance(value, dict):
        raise GenerationError(
            f"Script Batch request {result.custom_id!r} returned a non-object script"
        )
    return _script_from_output(cell, value)


def _script_from_output(cell: MatrixCell, value: Mapping[str, Any]) -> ConversationScript:
    raw_messages = value.get("messages")
    if not isinstance(raw_messages, list):
        raise GenerationError(f"Structured result for cell {cell.cell_id!r} has no messages array")
    expected_messages = cell.profile.turn_count * 2
    if len(raw_messages) != expected_messages:
        raise GenerationError(
            f"Structured result for cell {cell.cell_id!r} must contain exactly "
            f"{expected_messages} alternating messages"
        )
    parsed_messages = tuple(
        _parse_generated_message(message, index) for index, message in enumerate(raw_messages)
    )
    turns = tuple(
        ConversationTurn(user=user, assistant=assistant)
        for user, assistant in zip(parsed_messages[::2], parsed_messages[1::2])
    )
    for turn in turns:
        _validate_transcript_text(cell, turn.user)
        _validate_transcript_text(cell, turn.assistant)
    return ConversationScript(
        cell_id=cell.cell_id,
        model=cell.assistant_model,
        failure_mode="none",
        failure_turn=None,
        turns=turns,
    )


def _parse_generated_message(value: Any, index: int) -> str:
    if not isinstance(value, Mapping):
        raise GenerationError(f"Conversation script message {index} must be an object")
    expected_role = "user" if index % 2 == 0 else "assistant"
    role = value.get("role")
    if role != expected_role:
        raise GenerationError(
            f"Conversation script message {index} must have role {expected_role!r}, got {role!r}"
        )
    content = value.get("content")
    if not isinstance(content, str) or not content.strip():
        raise GenerationError(f"Conversation script message {index} must contain visible text")
    if content.strip().casefold() in {"user", "assistant"}:
        raise GenerationError(
            f"Conversation script message {index} contains a bare role-name placeholder"
        )
    return content


def _parse_turn(value: Any, index: int) -> ConversationTurn:
    if not isinstance(value, Mapping):
        raise GenerationError(f"Conversation script turn {index} must be an object")
    user = value.get("user")
    assistant = value.get("assistant")
    if not isinstance(user, str) or not isinstance(assistant, str):
        raise GenerationError(f"Conversation script turn {index} messages must be strings")
    return ConversationTurn(user=user, assistant=assistant)


def _failure_mode(value: Any) -> FailureMode:
    if not isinstance(value, str) or value not in FAILURE_MODES:
        raise GenerationError(f"Unsupported scripted failure mode {value!r}")
    return cast(FailureMode, value)


def _validate_transcript_text(cell: MatrixCell, content: str) -> None:
    lowered = content.casefold()
    forbidden = (*_RESERVED_TRANSCRIPT_PHRASES, *cell.profile.seed_intensities)
    if any(term.casefold() in lowered for term in forbidden):
        raise GenerationError(
            f"Generated transcript for cell {cell.cell_id!r} exposed internal context"
        )


def _response_output_text(body: Mapping[str, Any]) -> str:
    direct = body.get("output_text")
    if isinstance(direct, str):
        return direct
    output = body.get("output")
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, Mapping) or item.get("type") != "message":
                continue
            content = item.get("content")
            if not isinstance(content, list):
                continue
            for part in content:
                if (
                    isinstance(part, Mapping)
                    and part.get("type") == "output_text"
                    and isinstance(part.get("text"), str)
                ):
                    return cast(str, part["text"])
    raise GenerationError("Batch response body has no Responses output text")
