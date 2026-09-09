import pytest
from pydantic import ValidationError

from phoenix.db.types.data_stream_protocol.ui_state_types import PlaygroundUIContext


def test_legacy_playground_context_defaults_to_prompt_mode() -> None:
    context = PlaygroundUIContext.model_validate({"type": "playground"})
    assert context.mode == "prompts"
    assert context.evaluator_slots == []


def test_evaluator_context_preserves_explicit_slots_and_mode() -> None:
    context = PlaygroundUIContext.model_validate(
        {
            "type": "playground",
            "mode": "evaluators",
            "recordExperiments": False,
            "sampleSize": 20,
            "evaluatorSlots": [
                {"slot": "A", "name": "judge", "kind": "LLM"},
                {"slot": "B", "name": "candidate", "kind": "CODE", "isDirty": True},
            ],
        }
    )
    serialized = context.model_dump(by_alias=True)
    assert serialized["mode"] == "evaluators"
    assert serialized["instances"] == []
    assert serialized["evaluatorSlots"][1]["slot"] == "B"
    assert serialized["evaluatorSlots"][1]["isDirty"] is True
    assert serialized["recordExperiments"] is False


def test_evaluator_context_rejects_prompt_instance_ids_as_slots() -> None:
    with pytest.raises(ValidationError):
        PlaygroundUIContext.model_validate(
            {
                "type": "playground",
                "mode": "evaluators",
                "evaluatorSlots": [{"slot": 0, "name": "judge", "kind": "LLM"}],
            }
        )
