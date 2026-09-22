import pytest
from pydantic import ValidationError

from phoenix.db.types.data_stream_protocol.ui_state_types import PlaygroundUIContext


def test_legacy_playground_context_defaults_to_prompt_tasks() -> None:
    context = PlaygroundUIContext.model_validate(
        {"type": "playground", "instances": [{"instanceId": 1}]}
    )
    assert context.task_kind == "prompt"
    assert context.instances[0].task is None


def test_evaluator_tasks_travel_on_their_instances() -> None:
    context = PlaygroundUIContext.model_validate(
        {
            "type": "playground",
            "taskKind": "evaluator",
            "recordExperiments": False,
            "instances": [
                {
                    "instanceId": 3,
                    "task": {"kind": "evaluator", "evaluatorKind": "LLM", "name": "judge"},
                },
                {
                    "instanceId": 4,
                    "task": {
                        "kind": "evaluator",
                        "evaluatorKind": "CODE",
                        "name": "candidate",
                        "isDirty": True,
                    },
                },
            ],
        }
    )
    serialized = context.model_dump(by_alias=True)
    assert serialized["taskKind"] == "evaluator"
    assert serialized["recordExperiments"] is False
    assert serialized["instances"][0]["task"]["evaluatorKind"] == "LLM"
    assert serialized["instances"][1]["task"]["isDirty"] is True
    assert serialized["instances"][1]["task"]["name"] == "candidate"


def test_prompt_task_needs_no_evaluator_fields() -> None:
    context = PlaygroundUIContext.model_validate(
        {"type": "playground", "instances": [{"instanceId": 1, "task": {"kind": "prompt"}}]}
    )
    assert context.instances[0].task is not None
    assert context.instances[0].task.kind == "prompt"


def test_evaluator_task_rejects_unknown_evaluator_kinds() -> None:
    with pytest.raises(ValidationError):
        PlaygroundUIContext.model_validate(
            {
                "type": "playground",
                "instances": [
                    {
                        "instanceId": 1,
                        "task": {"kind": "evaluator", "evaluatorKind": "BUILTIN", "name": "x"},
                    }
                ],
            }
        )


def test_sessions_recorded_by_the_evaluator_mode_build_still_load() -> None:
    """Persisted turns carry the fields the retired evaluator mode wrote; they are ignored."""
    context = PlaygroundUIContext.model_validate(
        {
            "type": "playground",
            "mode": "evaluators",
            "sampleSize": 20,
            "evaluatorSlots": [{"slot": "A", "name": "judge", "kind": "LLM"}],
            "recordExperiments": False,
        }
    )
    assert context.task_kind == "prompt"
    assert context.record_experiments is False
    assert "mode" not in context.model_dump(by_alias=True)
