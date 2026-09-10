from unittest.mock import Mock, patch

import pytest
from phoenix.evals.evaluators import Score
from test_metadata import facets

from judge import evaluate_completeness
from metadata import TaskMetadata
from report import matches, summarize
from trajectory import render_trajectory, sql_measurements


def trajectory():
    return {
        "schema_version": "ATIF-v1.7",
        "agent": {"model_name": "BLINDED_MODEL"},
        "steps": [
            {"step_id": 1, "source": "user", "message": "Count traces"},
            {
                "step_id": 2,
                "source": "agent",
                "tool_calls": [
                    {
                        "tool_call_id": "a",
                        "function_name": "execute",
                        "arguments": {"code": "executeSql"},
                    },
                    {"tool_call_id": "b", "function_name": "get", "arguments": {}},
                ],
                "observation": {
                    "results": [
                        {"source_call_id": "a", "content": "SQL error"},
                        {"source_call_id": "b", "content": "2 traces"},
                    ]
                },
            },
            {"step_id": 3, "source": "agent", "message": "There are 3 traces."},
        ],
    }


def render(value=None, **kwargs):
    return render_trajectory(
        "Count traces",
        value or trajectory(),
        answer={"trace_count": 3},
        reference={"trace_count": 2},
        target_evidence=[],
        **kwargs,
    )


def test_renderer_preserves_parallel_results_errors_and_contradictions():
    result = render()
    assert result == render()
    assert not result.unavailable_reasons
    assert "Call a: execute" in result.text and "Result for b" in result.text
    assert "SQL error" in result.text and "There are 3 traces" in result.text
    assert "BLINDED_MODEL" not in result.text
    assert sql_measurements(None)["sql_succeeded"] is None
    assert sql_measurements([{"operation": "execute", "code": "executeSql"}])["sql_attempted"] == 0
    assert (
        sql_measurements(
            [{"operation": "executeSql", "outcome": "success", "error_envelope": True}]
        )["sql_succeeded"]
        is None
    )


def test_missing_evidence_and_size_limit_do_not_produce_judge_passes():
    incomplete = trajectory()
    incomplete["steps"][1]["observation"]["results"].pop()
    for rendered in (render(incomplete), render(max_chars=10)):
        assert rendered.unavailable_reasons
        with patch("judge.CompletenessEvaluator") as evaluator:
            record = evaluate_completeness(rendered, Mock())
            assert record["available"] is False
            assert record["numeric_rewards"] == {}
            evaluator.assert_not_called()
    assert len(render(max_chars=10).text) > 10  # Complete artifact retained, not truncated.


def test_native_completeness_score_provenance_is_preserved():
    native = Score(
        name="completeness",
        score=1,
        label="complete",
        explanation="All delivered",
        kind="llm",
        metadata={"model": "judge-model"},
    )
    with patch("judge.CompletenessEvaluator") as evaluator:
        evaluator.return_value.evaluate.return_value = [native]
        rendered = render()
        record = evaluate_completeness(rendered, Mock())
        evaluator.return_value.evaluate.assert_called_once_with({"conversation": rendered.text})
    assert record["scores"][0]["kind"] == "llm"
    assert record["scores"][0]["explanation"] == "All delivered"
    assert record["numeric_rewards"] == {"task_completeness": 1}


def test_compound_filters_and_missing_reward_cost_accounting():
    read = TaskMetadata(**facets())
    write = TaskMetadata(
        **facets(
            task_id="annotation-create",
            task_family_id="annotation-create",
            task_type="creation",
            primary_surface="annotations",
            product_surfaces=["annotations", "tracing"],
            operation_types=["create"],
            mutability="writes",
            challenge_tags=["precise_mutation_scope"],
        )
    )
    first = {
        "suites": "core",
        "mutability": "read_only",
        "task_type": "aggregation",
        "product_surfaces": "tracing",
    }
    second = {
        "mutability": "writes",
        "product_surfaces": "annotations",
        "challenge_tags": "precise_mutation_scope",
    }
    assert matches(read, first) and not matches(write, first)
    assert matches(write, second) and not matches(read, second)
    examples = [
        {"metadata": {"task_config": {"metadata": task.model_dump()}}} for task in [read, write]
    ]
    planned = [
        {
            "task_id": "trace-count",
            "trial_id": "1",
            "reward": 1,
            "attempts": [{"agent_cost_usd": 2}, {"agent_cost_usd": 1}],
        },
        {
            "task_id": "trace-count",
            "trial_id": "2",
            "reward": None,
            "attempts": [{"agent_cost_usd": None}],
        },
        {
            "task_id": "trace-count",
            "trial_id": "3",
            "reward": 0,
            "attempts": [{"agent_cost_usd": 4}],
        },
    ]
    report = summarize(examples, planned, filters=first)
    assert report["conditional_success_rate"] == 0.5
    assert report["unconditional_success_rate"] == 1 / 3
    assert report["known_agent_cost_usd"] == 7
    assert report["attempt_count"] == 4 and report["attempts_with_cost"] == 3
    assert report["filters"] == first
    with pytest.raises(ValueError, match="Unknown"):
        matches(read, {"uses_sql": True})


def test_report_cannot_silently_drop_unmapped_planned_trials():
    with pytest.raises(ValueError, match="missing task metadata"):
        summarize([], [{"task_id": "unknown", "trial_id": "1"}], filters={})


def test_sql_measurements_require_correlated_completed_operations():
    events = []
    for call_id, operation, error in [
        ("a", "executeSql", False),
        ("b", "executeSql", True),
        ("c", "describeSqlSchema", False),
    ]:
        event = {"operation": operation, "call_id": call_id}
        events += [
            event | {"phase": "started"},
            event
            | {
                "phase": "completed",
                "outcome": "error" if error else "success",
                "error_envelope": error,
            },
        ]
    assert sql_measurements(events) == {
        "sql_attempted": 2,
        "sql_succeeded": 1,
        "schema_inspected": 1,
        "sql_measurement_complete": 1,
    }
    for incomplete in [events[:-1], events + [events[0]], [{"kind": "sql", "sql": "SELECT 1"}]]:
        assert sql_measurements(incomplete)["sql_measurement_complete"] == 0
        assert sql_measurements(incomplete)["sql_succeeded"] is None


def test_validation_only_sql_is_not_counted_as_executed():
    event = {"operation": "executeSql", "call_id": "validation"}
    result = sql_measurements(
        [
            event | {"phase": "started"},
            event
            | {
                "phase": "completed",
                "outcome": "success",
                "error_envelope": False,
                "validate_only": True,
            },
        ]
    )
    assert result["sql_attempted"] == 1
    assert result["sql_succeeded"] == 0
    assert result["sql_measurement_complete"] == 1
