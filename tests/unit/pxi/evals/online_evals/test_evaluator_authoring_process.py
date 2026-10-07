from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest
from phoenix.client.__generated__ import v1

from evals.pxi.online_evals.evaluators import EVALUATORS
from evals.pxi.online_evals.evaluators.evaluator_authoring_process import (
    EVALUATOR_AUTHORING_PROCESS,
    evaluate_evaluator_authoring_process,
)

PLAN_WRITE = (
    "mkdir -p /home/user/workspace/evaluator-plans && "
    "cat > /home/user/workspace/evaluator-plans/cites.md <<'EOF'\n# plan\nEOF"
)
PLAN_UPDATE = (
    "sed -i 's/| cited | |/| cited | cited |/' /home/user/workspace/evaluator-plans/cites.md"
)
PLAN_READ = "cat /home/user/workspace/evaluator-plans/cites.md"


def _root() -> v1.Span:
    return {
        "name": "pxi.turn",
        "context": {"trace_id": "trace-1", "span_id": "root"},
        "span_kind": "AGENT",
        "start_time": "2026-10-07T00:00:00+00:00",
        "end_time": "2026-10-07T00:01:00+00:00",
        "status_code": "OK",
    }


def _tool(index: int, name: str, tool_input: dict[str, Any], *, status: str = "OK") -> v1.Span:
    return {
        "name": name,
        "context": {"trace_id": "trace-1", "span_id": f"tool-{index}"},
        "parent_id": "root",
        "span_kind": "TOOL",
        "start_time": f"2026-10-07T00:00:{index:02d}+00:00",
        "end_time": f"2026-10-07T00:00:{index:02d}.500+00:00",
        "status_code": status,
        "attributes": {"tool.name": name, "input.value": json.dumps(tool_input)},
    }


def _bash(index: int, command: str, *, status: str = "OK") -> v1.Span:
    return _tool(index, "bash", {"summary": "s", "command": command}, status=status)


def _browser(index: int, *operations: str) -> v1.Span:
    script = "\n".join(f"await ui.{operation}({{}});" for operation in operations)
    return _tool(index, "execute_browser_action", {"summary": "s", "script": script})


def _evaluate(*tools: v1.Span) -> Any:
    root = _root()
    return asyncio.run(evaluate_evaluator_authoring_process(root, [root, *tools]))


def test_is_registered_for_turn_roots() -> None:
    assert EVALUATORS["evaluator_authoring_process"] is EVALUATOR_AUTHORING_PROCESS
    assert EVALUATOR_AUTHORING_PROCESS.selector.names == ("pxi.turn",)


def test_turns_that_change_no_evaluator_are_not_applicable() -> None:
    assert _evaluate(_bash(1, "phoenix-gql '{ projects { edges { node { name } } } }'")) is None
    assert _evaluate(_browser(1, "evaluators.code.read")) is None


def test_editing_before_the_plan_is_unplanned() -> None:
    score = _evaluate(_browser(1, "evaluators.code.edit"), _bash(2, PLAN_WRITE))
    assert (score.label, score.score) == ("unplanned", 0.0)


def test_a_failed_plan_write_does_not_count() -> None:
    score = _evaluate(_bash(1, PLAN_WRITE, status="ERROR"), _browser(2, "evaluators.code.edit"))
    assert score.label == "unplanned"


def test_writing_the_plan_first_is_planned() -> None:
    score = _evaluate(
        _browser(1, "evaluators.code.read"),
        _bash(2, PLAN_WRITE),
        _browser(3, "evaluators.code.edit", "evaluators.code.test"),
    )
    assert (score.label, score.score) == ("planned", 1.0)
    assert score.metadata["steps"] == [
        "plan_write:bash",
        "edit:execute_browser_action",
        "preview:execute_browser_action",
    ]


def test_reading_the_approved_plan_in_a_later_turn_is_planned() -> None:
    score = _evaluate(_bash(1, PLAN_READ), _browser(2, "playground.evaluator.edit"))
    assert score.label == "planned"


@pytest.mark.parametrize(
    "tools, label",
    [
        pytest.param(
            [
                _bash(1, PLAN_WRITE),
                _browser(2, "evaluators.code.edit", "evaluators.code.test"),
                _bash(3, PLAN_UPDATE),
                _browser(4, "evaluators.code.submit"),
            ],
            "planned_and_validated",
            id="browser",
        ),
        pytest.param(
            [
                _bash(1, PLAN_WRITE),
                _bash(
                    2,
                    "phoenix-gql 'mutation { evaluatorPreviews(input: $input) { results { error } } }'",
                ),
                _bash(3, PLAN_UPDATE),
                _bash(
                    4,
                    "phoenix-gql 'mutation { createCodeEvaluator(input: $input) { evaluator { id } } }'",
                ),
            ],
            "planned_and_validated",
            id="graphql",
        ),
        pytest.param(
            [_bash(1, PLAN_WRITE), _browser(2, "evaluators.code.edit", "evaluators.code.submit")],
            "planned_not_validated",
            id="saved-without-preview",
        ),
        pytest.param(
            [
                _bash(1, PLAN_WRITE),
                _browser(2, "playground.run"),
                _browser(3, "playground.evaluator.save"),
            ],
            "planned_not_validated",
            id="saved-without-recording-results",
        ),
    ],
)
def test_saves_need_a_preview_recorded_in_the_plan(tools: list[v1.Span], label: str) -> None:
    score = _evaluate(*tools)
    assert score.label == label
    assert score.score == (1.0 if label == "planned_and_validated" else 0.5)


def test_a_rename_in_the_save_mutation_name_does_not_count_as_a_save() -> None:
    # `createCodeEvaluatorVersion` is a save, but a substring such as a query field
    # named after a mutation is not: names match whole words.
    score = _evaluate(
        _bash(1, PLAN_WRITE), _bash(2, "phoenix-gql schema --names CreateCodeEvaluatorInput")
    )
    assert score is None
