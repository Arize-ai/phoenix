"""Keep setup choices out of read-only fixtures' repetition checks."""

from typing import Any

import pytest

from evals.pxi.evaluators.tools import evaluate_tool_call_count, evaluate_tools_called


def _calls(*calls: tuple[str, Any]) -> dict[str, Any]:
    return {
        "messages": [
            {
                "parts": [
                    {
                        "part_kind": "tool-call",
                        "tool_name": name,
                        "args": args,
                        "tool_call_id": str(i),
                    }
                    for i, (name, args) in enumerate(calls)
                ]
            }
        ]
    }


def test_distinct_prerequisites_do_not_consume_repeat_budget() -> None:
    output = _calls(
        ("load_skill", {"skill_name": "experiments"}),
        ("load_skill", {"skill_name": "playground"}),
        ("load_skill", {"skill_name": "phoenix-graphql"}),
        (
            "load_skill_reference",
            {"skill_name": "phoenix-graphql", "reference_name": "references/experiments.md"},
        ),
        ("bash", {"summary": "Read results", "command": "phoenix-gql query.graphql"}),
    )
    assert (
        evaluate_tool_call_count(output, {"budgets": {"max_repeated_tool_calls": 0}})["score"] == 1
    )
    assert evaluate_tool_call_count(output, {"budgets": {"max_tool_calls": 4}})["score"] == 0


def test_identical_calls_are_repeats_despite_ids_and_argument_serialization() -> None:
    output = _calls(
        (
            "load_skill_reference",
            {"skill_name": "phoenix-graphql", "reference_name": "references/experiments.md"},
        ),
        ("search", {"query": "results"}),
        (
            "load_skill_reference",
            '{"reference_name":"references/experiments.md","skill_name":"phoenix-graphql"}',
        ),
    )
    result = evaluate_tool_call_count(output, {"budgets": {"max_repeated_tool_calls": 0}})
    assert result["score"] == 0
    assert result["metadata"]["repeated_tools"] == ["load_skill_reference"]


def test_repeat_allowance_counts_each_extra_call() -> None:
    output = _calls(*[("search", {"query": "results"})] * 3)
    assert (
        evaluate_tool_call_count(output, {"budgets": {"max_repeated_tool_calls": 1}})["score"] == 0
    )
    assert (
        evaluate_tool_call_count(output, {"budgets": {"max_repeated_tool_calls": 2}})["score"] == 1
    )


def test_recovery_with_corrected_arguments_is_not_a_repeat() -> None:
    output = _calls(
        (
            "load_skill_reference",
            {"skill_name": "experiments", "reference_name": "references/experiments.md"},
        ),
        (
            "load_skill_reference",
            {"skill_name": "phoenix-graphql", "reference_name": "references/experiments.md"},
        ),
    )
    assert (
        evaluate_tool_call_count(output, {"budgets": {"max_repeated_tool_calls": 0}})["score"] == 1
    )


def test_total_limit_still_applies_when_both_limits_are_present() -> None:
    output = _calls(("search", {"query": "results"}), ("bash", {"command": "pwd"}))
    assert (
        evaluate_tool_call_count(
            output, {"budgets": {"max_tool_calls": 1, "max_repeated_tool_calls": 0}}
        )["score"]
        == 0
    )


@pytest.mark.parametrize("value", [-1, "1", True])
def test_invalid_repeat_limit_fails(value: Any) -> None:
    assert (
        evaluate_tool_call_count(_calls(), {"budgets": {"max_repeated_tool_calls": value}})["score"]
        == 0
    )


def test_forbidden_writes_still_fail_without_repeated_calls() -> None:
    output = _calls(
        (
            "execute_browser_action",
            {"script": "await ui.experiment.patch({experimentId: 'e1', metadata: {}});"},
        )
    )
    expected = {
        "ui_operations": {"forbidden": ["experiment.patch"]},
        "budgets": {"max_repeated_tool_calls": 0},
    }
    assert evaluate_tool_call_count(output, expected)["score"] == 1
    assert evaluate_tools_called(output, expected)["score"] == 0
