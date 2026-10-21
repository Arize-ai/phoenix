from typing import Any

import pytest

from phoenix.db.types.decisions import (
    ChoiceQuestion,
    DecisionTaskConfig,
    PredicateQuestion,
)
from phoenix.server.api.helpers.decision_clients import (
    ChoiceAnswer,
    DecisionResponse,
    PredicateAnswer,
    RefusalAnswer,
    ScaleAnswer,
)
from phoenix.server.api.helpers.decision_experiments import (
    build_example_request,
    decision_run_output,
)


def task_config(**state: Any) -> DecisionTaskConfig:
    """Each example supplies state for the task's fixed questions."""
    return DecisionTaskConfig.model_validate(
        {
            "inputs": [{"name": "state"}],
            "state": state or {"type": "input", "name": "state"},
            "questions": [
                {
                    "type": "predicate",
                    "name": "decision",
                    "instructions": "Is the passage about rivers?",
                }
            ],
        }
    )


def ask(config: DecisionTaskConfig, input: dict[str, Any], **example: Any) -> Any:
    return build_example_request(
        config,
        input=input,
        output=example.get("output", {}),
        metadata=example.get("metadata", {}),
    )


def test_a_structured_state_is_sent_unchanged() -> None:
    """Typed Decisions' states are JSON objects whose keys vary per workflow."""
    state = {"agent": {"autonomy": "checkpointed"}, "constraints": ["Spend under $50"]}
    request = ask(task_config(), {"state": state})
    assert request.state == state
    assert request.questions == [
        PredicateQuestion(
            type="predicate", name="decision", instructions="Is the passage about rivers?"
        )
    ]


def test_a_text_state_can_still_render_a_template() -> None:
    request = ask(
        task_config(type="text", template="Passage: {{state}}", template_format="MUSTACHE"),
        {"state": "The Nile is long."},
    )
    assert request.state == "Passage: The Nile is long."


TEAM = {
    "type": "choice",
    "name": "team",
    "instructions": "Which team?",
    "choices": [{"value": "billing"}, {"value": "technical"}],
}


def test_the_task_questions_are_asked_of_every_example() -> None:
    """Input values are read by input name, as a prompt reads template variables, and
    other fields of the example are ignored."""
    config = DecisionTaskConfig.model_validate(
        {
            "inputs": [{"name": "ticket"}],
            "state": {"type": "text", "template": "{{ticket}}", "template_format": "MUSTACHE"},
            "questions": [TEAM],
        }
    )
    request = ask(config, {"ticket": "Refund me", "customer": "acme", "questions": {"ignored": {}}})
    assert request.state == "Refund me"
    assert isinstance(request.questions[0], ChoiceQuestion)


def test_an_empty_path_reads_input_values_from_the_whole_context() -> None:
    config = DecisionTaskConfig.model_validate(
        {
            "inputs": [{"name": "input"}, {"name": "metadata"}],
            "state": {"type": "object"},
            "questions": [TEAM],
            "input_values_path": "",
        }
    )
    request = ask(config, {"ticket": "Refund me"}, metadata={"tier": "pro"})
    assert request.state == {"input": {"ticket": "Refund me"}, "metadata": {"tier": "pro"}}


@pytest.mark.parametrize(
    ("example", "message"),
    [
        pytest.param({}, "Missing inputs: state", id="missing-state"),
        pytest.param({"state": ""}, "empty", id="empty-state"),
    ],
)
def test_an_example_that_cannot_be_asked_says_why(example: Any, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        ask(task_config(), example)


def test_a_missing_input_values_path_says_so() -> None:
    config = task_config().model_copy(update={"input_values_path": "input.nope.deeper"})
    with pytest.raises(ValueError, match=r"^Input values: ") as excinfo:
        ask(config, {"state": "x"})
    assert "nope" in str(excinfo.value)
    assert isinstance(excinfo.value.__cause__, (KeyError, TypeError))


def test_input_values_that_are_not_an_object_say_so() -> None:
    config = task_config()
    config = config.model_copy(update={"input_values_path": "input.state"})
    with pytest.raises(ValueError, match="are not an object"):
        ask(config, {"state": "x"})


def test_the_run_output_keeps_full_answers_by_question_name() -> None:
    output = decision_run_output(
        DecisionResponse(
            model="tev1:0.8b-mxfp8",
            answers={
                "urgent": PredicateAnswer(probability=0.93),
                "team": ChoiceAnswer(
                    choice="billing",
                    confidence=0.8,
                    probabilities={"billing": 0.8, "technical": 0.2},
                ),
                "severity": ScaleAnswer(
                    expected_level=1.4, confidence=0.7, probabilities={0: 0.1, 1: 0.4, 2: 0.5}
                ),
                "other": RefusalAnswer(),
            },
            input_tokens=10,
            output_tokens=1,
        )
    )
    assert output == {
        "task_output": {
            "urgent": {"type": "predicate", "probability": 0.93},
            "team": {
                "type": "choice",
                "choice": "billing",
                "confidence": 0.8,
                "probabilities": {"billing": 0.8, "technical": 0.2},
            },
            "severity": {
                "type": "scale",
                "expected_level": 1.4,
                "confidence": 0.7,
                "probabilities": {"0": 0.1, "1": 0.4, "2": 0.5},
            },
            "other": {"type": "refusal"},
        }
    }
