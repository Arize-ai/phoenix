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
    ScaleAnswer,
)
from phoenix.server.api.helpers.decision_experiments import (
    build_example_request,
    decision_run_output,
)


def benchmark_config(**state: Any) -> DecisionTaskConfig:
    """Questions and state read from each example, as datagen's benchmarks are seeded."""
    return DecisionTaskConfig.model_validate(
        {
            "inputs": [{"name": "state"}],
            "state": state or {"type": "input", "name": "state"},
            "input_mapping": {"literal_mapping": {}, "path_mapping": {"state": "input.state"}},
            "questions": {"type": "example", "path": "input.questions", "format": "system_one"},
        }
    )


def context(state: Any, questions: dict[str, Any]) -> dict[str, Any]:
    return {"input": {"state": state, "questions": questions}, "output": {}, "metadata": {}}


NOUL = {"decision": {"type": "noul", "instructions": "Is the passage about rivers?"}}


def test_a_structured_state_is_sent_unchanged() -> None:
    """Typed Decisions' states are JSON objects whose keys vary per workflow."""
    state = {"agent": {"autonomy": "checkpointed"}, "constraints": ["Spend under $50"]}
    request = build_example_request(benchmark_config(), context(state, NOUL))
    assert request.state == state
    assert request.questions == [
        PredicateQuestion(
            type="predicate", name="decision", instructions="Is the passage about rivers?"
        )
    ]


def test_a_text_state_can_still_render_a_template() -> None:
    request = build_example_request(
        benchmark_config(type="text", template="Passage: {{state}}", template_format="MUSTACHE"),
        context("The Nile is long.", NOUL),
    )
    assert request.state == "Passage: The Nile is long."


def test_fixed_questions_ignore_the_example() -> None:
    config = DecisionTaskConfig.model_validate(
        {
            "inputs": [{"name": "ticket"}],
            "state": {"type": "text", "template": "{{ticket}}", "template_format": "MUSTACHE"},
            "input_mapping": {"literal_mapping": {}, "path_mapping": {"ticket": "input.body"}},
            "questions": {
                "type": "fixed",
                "questions": [
                    {
                        "type": "choice",
                        "name": "team",
                        "instructions": "Which team?",
                        "choices": [{"value": "billing"}, {"value": "technical"}],
                    }
                ],
            },
        }
    )
    request = build_example_request(config, {"input": {"body": "Refund me"}, "metadata": {}})
    assert request.state == "Refund me"
    assert isinstance(request.questions[0], ChoiceQuestion)


@pytest.mark.parametrize(
    ("example", "message"),
    [
        pytest.param({"input": {"questions": NOUL}}, "did not match", id="missing-state"),
        pytest.param({"input": {"state": "x"}}, "did not match", id="missing-questions"),
        pytest.param(context("x", {"q": {"type": "box"}}), "unsupported type", id="box"),
        pytest.param(context("", NOUL), "empty", id="empty-state"),
        pytest.param(
            context("x", {"q": {"type": "choice", "instructions": "?", "criteria": {"a": None}}}),
            "2 to 255 choices",
            id="one-choice",
        ),
    ],
)
def test_an_example_that_cannot_be_asked_says_why(example: Any, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        build_example_request(benchmark_config(), example)


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
            },
            input_tokens=10,
            output_tokens=1,
        )
    )
    assert output == {
        "task_output": {
            "model": "tev1:0.8b-mxfp8",
            "answers": {
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
            },
        }
    }
