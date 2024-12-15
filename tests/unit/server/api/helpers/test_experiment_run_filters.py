import ast

import pytest

from phoenix.server.api.helpers.experiment_run_filters import ExperimentRunFilterTransformer


@pytest.mark.parametrize(
    "filter_expression,expected_sqlite_expression",
    [
        pytest.param(
            "input",
            "dataset_example_revisions.input",
            id="input-name",
        ),
        pytest.param(
            "reference_output",
            "dataset_example_revisions.output",
            id="reference-output-name",
        ),
        pytest.param(
            "output",
            "experiment_runs.output",
            id="output-name",
        ),
        pytest.param(
            "error",
            "experiment_runs.error",
            id="error-name",
        ),
        pytest.param(
            "latency_ms",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1)",  # noqa: E501
            id="latency-ms-name",
        ),
        pytest.param(
            "experiments[0].input",
            "dataset_example_revisions.input",
            id="experiment-input-name",
        ),
        pytest.param(
            "experiments[0].reference_output",
            "dataset_example_revisions.output",
            id="experiment-reference-output-name",
        ),
        pytest.param(
            "experiments[1].output",
            "experiment_runs.output",
            id="experiment-output-name",
        ),
        pytest.param(
            "experiments[1].error",
            "experiment_runs.error",
            id="experiment-error-name",
        ),
        pytest.param(
            "experiments[2].latency_ms",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1)",  # noqa: E501
            id="experiment-latency-ms-name",
        ),
        pytest.param(
            "error is None",
            "experiment_runs.error IS NULL AND experiment_runs.experiment_id = 0",
            id="is-none",
        ),
        pytest.param(
            "error is not None",
            "experiment_runs.error IS NOT NULL AND experiment_runs.experiment_id = 0",
            id="is-not-none",
        ),
        pytest.param(
            "latency_ms > 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) > 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="gt",
        ),
        pytest.param(
            "1000 < latency_ms",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) > 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="gt-reversed",
        ),
        pytest.param(
            "latency_ms >= 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) >= 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="gte",
        ),
        pytest.param(
            "1000 <= latency_ms",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) >= 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="gte-reversed",
        ),
        pytest.param(
            "latency_ms < 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) < 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="lt",
        ),
        pytest.param(
            "1000 > latency_ms",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) < 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="lt-reversed",
        ),
        pytest.param(
            "latency_ms <= 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) <= 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="lte",
        ),
        pytest.param(
            "1000 >= latency_ms",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) <= 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="lte-reversed",
        ),
        pytest.param(
            "latency_ms == 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) = 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="eq",
        ),
        pytest.param(
            "1000 == latency_ms",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) = 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="eq-reversed",
        ),
        pytest.param(
            "latency_ms != 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) != 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="ne",
        ),
        pytest.param(
            "1000 != latency_ms",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) != 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="ne-reversed",
        ),
        pytest.param(
            "experiments[2].error is None",
            "experiment_runs.error IS NULL AND experiment_runs.experiment_id = 2",
            id="experiment-error-is-none",
        ),
        pytest.param(
            "experiments[1].error is not None",
            "experiment_runs.error IS NOT NULL AND experiment_runs.experiment_id = 1",
            id="experiment-error-is-not-none",
        ),
        pytest.param(
            "experiments[1].latency_ms > 10",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) > 10 AND experiment_runs.experiment_id = 1",  # noqa: E501
            id="experiment-latency-gt",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5",
            "experiment_run_annotations.score > 0.5 AND experiment_runs.experiment_id = 0 AND experiment_run_annotations.name = 'Hallucination'",  # noqa: E501
            id="experiment-hallucination-score-gt",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].label == 'hallucinated'",
            "experiment_run_annotations.label = 'hallucinated' AND experiment_runs.experiment_id = 0 AND experiment_run_annotations.name = 'Hallucination'",  # noqa: E501
            id="experiment-hallucination-label-eq",
        ),
        pytest.param(
            "not experiments[0].evals['Hallucination'].label == 'hallucinated'",
            "NOT (experiment_run_annotations.label = 'hallucinated' AND experiment_runs.experiment_id = 0 AND experiment_run_annotations.name = 'Hallucination')",  # noqa: E501
            id="negation",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5 and latency_ms > 1000",
            "experiment_run_annotations.score > 0.5 AND experiment_runs.experiment_id = 0 AND experiment_run_annotations.name = 'Hallucination' AND round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) > 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="conjunction",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5 and latency_ms > 1000 and experiments[1].error is None",  # noqa: E501
            "experiment_run_annotations.score > 0.5 AND experiment_runs.experiment_id = 0 AND experiment_run_annotations.name = 'Hallucination' AND round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) > 1000 AND experiment_runs.experiment_id = 0 AND experiment_runs.error IS NULL AND experiment_runs.experiment_id = 1",  # noqa: E501
            id="conjunction-of-three",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5 or latency_ms > 1000",
            "experiment_run_annotations.score > 0.5 AND experiment_runs.experiment_id = 0 AND experiment_run_annotations.name = 'Hallucination' OR round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) > 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="disjunction",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5 or latency_ms > 1000 or experiments[1].error is None",  # noqa: E501
            "experiment_run_annotations.score > 0.5 AND experiment_runs.experiment_id = 0 AND experiment_run_annotations.name = 'Hallucination' OR round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) > 1000 AND experiment_runs.experiment_id = 0 OR experiment_runs.error IS NULL AND experiment_runs.experiment_id = 1",  # noqa: E501
            id="disjunction-of-three",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5 or latency_ms > 1000 and experiments[1].error is None",  # noqa: E501
            "experiment_run_annotations.score > 0.5 AND experiment_runs.experiment_id = 0 AND experiment_run_annotations.name = 'Hallucination' OR round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) > 1000 AND experiment_runs.experiment_id = 0 AND experiment_runs.error IS NULL AND experiment_runs.experiment_id = 1",  # noqa: E501
            id="mixed-conjunction-and-disjunction-without-parentheses",
        ),
        pytest.param(
            "not (experiments[0].evals['Hallucination'].score > 0.5 or latency_ms > 1000)",
            "NOT (experiment_run_annotations.score > 0.5 AND experiment_runs.experiment_id = 0 AND experiment_run_annotations.name = 'Hallucination' OR round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) > 1000 AND experiment_runs.experiment_id = 0)",  # noqa: E501
            id="complex-negation",
        ),
    ],
)
def test_experiment_run_filter_transformer_correctly_compiles(
    filter_expression: str, expected_sqlite_expression: str, dialect: str
) -> None:
    if dialect == "postgres":
        pytest.skip("test case currently works only in postgres")
    tree = ast.parse(filter_expression, mode="eval")
    transformer = ExperimentRunFilterTransformer([0, 1, 2])
    transformed_tree = transformer.visit(tree)
    node = transformed_tree.body
    orm_expression = node.compile()
    sql_expression = str(orm_expression.compile(compile_kwargs={"literal_binds": True}))
    assert sql_expression == expected_sqlite_expression
