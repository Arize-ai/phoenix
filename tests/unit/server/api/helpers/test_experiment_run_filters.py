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
            "error is None",
            "experiment_runs.error IS NULL AND experiment_runs.experiment_id = 0",
            id="primitive-is-none-expression",
        ),
        pytest.param(
            "error is not None",
            "experiment_runs.error IS NOT NULL AND experiment_runs.experiment_id = 0",
            id="primitive-is-not-none-expression",
        ),
        pytest.param(
            "latency_ms > 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) > 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="primitive-gt-expression",
        ),
        pytest.param(
            "latency_ms >= 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) >= 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="primitive-gte-expression",
        ),
        pytest.param(
            "latency_ms < 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) < 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="primitive-lt-expression",
        ),
        pytest.param(
            "latency_ms <= 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) <= 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="primitive-lte-expression",
        ),
        pytest.param(
            "latency_ms == 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) = 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="primitive-eq-expression",
        ),
        pytest.param(
            "latency_ms != 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) != 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="primitive-ne-expression",
        ),
        pytest.param(
            "experiments[0].input",
            "dataset_example_revisions.input",
            id="experiment_0_input",
        ),
        pytest.param(
            "experiments[1].output",
            "experiment_runs.output",
            id="experiment_1_output",
        ),
        pytest.param(
            "experiments[2].error is None",
            "experiment_runs.error IS NULL AND experiment_runs.experiment_id = 2",
            id="experiment_2_error_is_none",
        ),
        pytest.param(
            "experiments[0].error is not None",
            "experiment_runs.error IS NOT NULL AND experiment_runs.experiment_id = 0",
            id="experiment_0_error_is_not_none",
        ),
        pytest.param(
            "experiments[1].latency_ms > 10",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) > 10 AND experiment_runs.experiment_id = 1",  # noqa: E501
            id="experiment_1_latency_comparison",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5",
            "experiment_run_annotations.score > 0.5 AND experiment_runs.experiment_id = 0 AND experiment_run_annotations.name = 'Hallucination'",  # noqa: E501
            id="experiment_0_hallucination_score",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].label == 'hallucinated'",
            "experiment_run_annotations.label = 'hallucinated' AND experiment_runs.experiment_id = 0 AND experiment_run_annotations.name = 'Hallucination'",  # noqa: E501
            id="experiment_0_hallucination_label",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5 or latency_ms > 1000",
            "experiment_run_annotations.score > 0.5 AND experiment_runs.experiment_id = 0 AND experiment_run_annotations.name = 'Hallucination' OR round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) > 1000 AND experiment_runs.experiment_id = 0",  # noqa: E501
            id="complex_or_condition",
        ),
        pytest.param(
            "not (experiments[0].evals['Hallucination'].score > 0.5 or latency_ms > 1000)",
            "NOT (experiment_run_annotations.score > 0.5 AND experiment_runs.experiment_id = 0 AND experiment_run_annotations.name = 'Hallucination' OR round(CAST((EXTRACT(EPOCH FROM experiment_runs.end_time) - EXTRACT(EPOCH FROM experiment_runs.start_time)) * 1000 AS NUMERIC), 1) > 1000 AND experiment_runs.experiment_id = 0)",  # noqa: E501
            id="complex_not_condition",
        ),
    ],
)
def test_node_transformer(
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
