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
from typing import Any, Literal, Mapping, Sequence, cast

if __package__:
    from scripts.datagen.generation import GenerationError, MatrixCell
    from scripts.datagen.openai_batch import BatchRequest, BatchResult, custom_id
else:
    from generation import GenerationError, MatrixCell
    from openai_batch import (
        BatchRequest,
        BatchResult,
        custom_id,
    )

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

_SCRIPT_OUTPUT_SCHEMA: Mapping[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["turns"],
    "properties": {
        "turns": {
            "type": "array",
            "minItems": 1,
            "maxItems": 16,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["user", "assistant"],
                "properties": {
                    "user": {"type": "string", "minLength": 1},
                    "assistant": {"type": "string", "minLength": 1},
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


def build_script_request(run_id: str, cell: MatrixCell) -> BatchRequest:
    """Build one Responses Batch row for a scripted matrix cell."""
    if cell.lane != "scripted":
        raise GenerationError(f"Cell {cell.cell_id} belongs to {cell.lane}, not scripted")
    factors = json.dumps(cell.factors, sort_keys=True, separators=(",", ":"))
    prompt = (
        "Write one coherent whole conversation for an offline telemetry fixture. "
        "Return only the requested JSON object. Each turn must contain a realistic user "
        "message and the assistant response that should be replayed verbatim. Use these "
        f"scenario factors: {factors}"
    )
    return BatchRequest(
        custom_id=custom_id(run_id, cell.cell_id, "script"),
        body={
            "model": cell.assistant_model,
            "input": prompt,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "conversation_script",
                    "strict": True,
                    "schema": _SCRIPT_OUTPUT_SCHEMA,
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
    raw_turns = value.get("turns")
    if not isinstance(raw_turns, list):
        raise GenerationError(f"Script Batch request {result.custom_id!r} has no turns array")
    turns = tuple(_parse_turn(turn, index) for index, turn in enumerate(raw_turns))
    failure_mode = _failure_mode(cell.factors.get("failure_mode", "none"))
    raw_failure_turn = cell.factors.get("failure_turn", 0 if failure_mode != "none" else None)
    if raw_failure_turn is not None and not isinstance(raw_failure_turn, int):
        raise GenerationError(f"Cell {cell.cell_id} failure_turn must be an integer")
    return ConversationScript(
        cell_id=cell.cell_id,
        model=cell.assistant_model,
        failure_mode=failure_mode,
        failure_turn=raw_failure_turn,
        turns=turns,
    )


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
