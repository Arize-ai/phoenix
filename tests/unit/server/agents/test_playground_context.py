import pytest
from pydantic import ValidationError
from strawberry.relay import GlobalID

from phoenix.db.types.data_stream_protocol.ui_state_types import PlaygroundUIContext
from phoenix.server.agents.context import ChatContext, resolve_contexts


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


def test_evaluator_task_names_the_binding_it_was_loaded_from() -> None:
    project_evaluator_id = str(GlobalID("ProjectEvaluator", "7"))
    evaluator_id = str(GlobalID("CodeEvaluator", "3"))
    context = PlaygroundUIContext.model_validate(
        {
            "type": "playground",
            "taskKind": "evaluator",
            "instances": [
                {
                    "instanceId": 1,
                    "task": {
                        "kind": "evaluator",
                        "evaluatorKind": "CODE",
                        "name": "has_answer",
                        "source": {
                            "evaluatorId": evaluator_id,
                            "datasetEvaluatorId": None,
                            "projectEvaluatorId": project_evaluator_id,
                        },
                    },
                },
                {
                    "instanceId": 2,
                    "task": {"kind": "evaluator", "evaluatorKind": "LLM", "name": "draft"},
                },
            ],
        }
    )
    serialized = context.model_dump(by_alias=True)
    assert serialized["instances"][0]["task"]["source"] == {
        "evaluatorId": evaluator_id,
        "datasetEvaluatorId": None,
        "projectEvaluatorId": project_evaluator_id,
    }
    # Older clients send no source; the task still parses.
    assert serialized["instances"][1]["task"]["source"] is None


def test_evaluator_task_source_rejects_an_id_of_the_wrong_type() -> None:
    with pytest.raises(ValidationError):
        PlaygroundUIContext.model_validate(
            {
                "type": "playground",
                "instances": [
                    {
                        "instanceId": 1,
                        "task": {
                            "kind": "evaluator",
                            "evaluatorKind": "CODE",
                            "name": "has_answer",
                            "source": {"projectEvaluatorId": str(GlobalID("Dataset", "1"))},
                        },
                    }
                ],
            }
        )


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({}, id="details-page"),
        pytest.param({"form": "edit", "evaluatorKind": "CODE"}, id="edit-form"),
    ],
)
def test_project_evaluator_context_resolves(payload: dict[str, str]) -> None:
    project_id = str(GlobalID("Project", "1"))
    project_evaluator_id = str(GlobalID("ProjectEvaluator", "7"))
    resolved = resolve_contexts(
        [
            ChatContext.model_validate(
                {
                    "type": "project_evaluator",
                    "projectNodeId": project_id,
                    "projectEvaluatorNodeId": project_evaluator_id,
                    **payload,
                }
            )
        ]
    )
    assert resolved.project_evaluator is not None
    assert resolved.project_evaluator.project_evaluator_node_id == project_evaluator_id
    assert resolved.project_evaluator.form == payload.get("form")


def test_project_evaluator_create_form_has_no_evaluator_yet() -> None:
    resolved = resolve_contexts(
        [
            ChatContext.model_validate(
                {
                    "type": "project_evaluator",
                    "projectNodeId": str(GlobalID("Project", "1")),
                    "form": "create",
                    "evaluatorKind": "LLM",
                }
            )
        ]
    )
    assert resolved.project_evaluator is not None
    assert resolved.project_evaluator.project_evaluator_node_id is None
