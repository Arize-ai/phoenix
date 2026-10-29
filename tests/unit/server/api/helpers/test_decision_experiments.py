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


def task_config(template_format: str = "MUSTACHE", **state: Any) -> DecisionTaskConfig:
    """Each example supplies state for the task's fixed questions."""
    return DecisionTaskConfig.model_validate(
        {
            "template_format": template_format,
            "state": state or {"type": "json", "template": "{{state}}"},
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
        task_config(type="text", template="Passage: {{state}}"),
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
    """Variables are read by name, as a prompt reads template variables, and other fields
    of the example are ignored."""
    config = DecisionTaskConfig.model_validate(
        {
            "template_format": "MUSTACHE",
            "state": {"type": "text", "template": "{{ticket}}"},
            "questions": [TEAM],
        }
    )
    request = ask(config, {"ticket": "Refund me", "customer": "acme", "questions": {"ignored": {}}})
    assert request.state == "Refund me"
    assert isinstance(request.questions[0], ChoiceQuestion)


def test_an_empty_path_reads_variables_from_the_whole_context() -> None:
    config = DecisionTaskConfig.model_validate(
        {
            "template_format": "MUSTACHE",
            "state": {
                "type": "json",
                "template": {"input": "{{input}}", "metadata": "{{metadata}}"},
            },
            "questions": [TEAM],
            "template_variables_path": "",
        }
    )
    request = ask(config, {"ticket": "Refund me"}, metadata={"tier": "pro"})
    assert request.state == {"input": {"ticket": "Refund me"}, "metadata": {"tier": "pro"}}


@pytest.mark.parametrize(
    ("example", "message"),
    [
        pytest.param({}, "Missing variables: state", id="missing-state"),
        pytest.param({"state": ""}, "empty", id="empty-state"),
    ],
)
def test_an_example_that_cannot_be_asked_says_why(example: Any, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        ask(task_config(), example)


def test_a_missing_template_variables_path_says_so() -> None:
    config = task_config().model_copy(update={"template_variables_path": "input.nope.deeper"})
    with pytest.raises(ValueError, match=r"^Template variables: ") as excinfo:
        ask(config, {"state": "x"})
    assert "nope" in str(excinfo.value)
    assert isinstance(excinfo.value.__cause__, (KeyError, TypeError))


def test_template_variables_that_are_not_an_object_say_so() -> None:
    config = task_config()
    config = config.model_copy(update={"template_variables_path": "input.state"})
    with pytest.raises(ValueError, match="are not an object"):
        ask(config, {"state": "x"})


def test_example_values_keep_their_types_and_fill_question_templates() -> None:
    config = DecisionTaskConfig.model_validate(
        {
            "template_format": "MUSTACHE",
            "state": {"type": "json", "template": {"count": "{{count}}", "ok": "{{ok}}"}},
            "questions": [
                {"type": "predicate", "name": "decision", "instructions": "Over {{limit}}?"}
            ],
        }
    )
    request = ask(config, {"count": 3, "ok": False, "limit": 2, "unused": None})
    assert request.state == {"count": 3, "ok": False}
    assert request.questions[0].instructions == "Over 2?"
    # The task's own questions stay templates.
    assert config.questions[0].instructions == "Over {{limit}}?"


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
