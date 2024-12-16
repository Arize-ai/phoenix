import ast

import pytest

from phoenix.server.api.helpers.experiment_run_filters import (
    ExperimentRunFilterConditionParseError,
    ExperimentRunFilterTransformer,
    validate_filter_condition,
)


@pytest.mark.parametrize(
    "filter_expression,expected_sqlite_expression",
    (
        # primitive names
        pytest.param(
            "1",
            "1",
            id="int-constant",
        ),
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
            "experiment_runs_0.output",
            id="output-name",
        ),
        pytest.param(
            "error",
            "experiment_runs_0.error",
            id="error-name",
        ),
        pytest.param(
            "latency_ms",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1)",  # noqa: E501
            id="latency-ms-name",
        ),
        # experiment run attributes
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
            "experiment_runs_1.output",
            id="experiment-output-name",
        ),
        pytest.param(
            "experiments[1].error",
            "experiment_runs_1.error",
            id="experiment-error-name",
        ),
        pytest.param(
            "experiments[2].latency_ms",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs_2.end_time) - EXTRACT(EPOCH FROM experiment_runs_2.start_time)) * 1000 AS NUMERIC), 1)",  # noqa: E501
            id="experiment-latency-ms-name",
        ),
        # json attributes
        pytest.param(
            'input["question"]',
            "dataset_example_revisions.input['question']",
            id="json-attribute-string-key",
        ),
        pytest.param(
            "output[0]",
            "experiment_runs_0.output[0]",
            id="json-attribute-int-key",
        ),
        pytest.param(
            'reference_output[0]["question"]',
            "dataset_example_revisions.output[0]['question']",
            id="json-attribute-nested-int-string-keys",
        ),
        pytest.param(
            'reference_output["question"][0]',
            "dataset_example_revisions.output['question'][0]",
            id="json-attribute-nested-string-int-keys",
        ),
        pytest.param(
            'experiments[0].input["question"]',
            "dataset_example_revisions.input['question']",
            id="experiment-json-attribute-string-key",
        ),
        pytest.param(
            "experiments[1].output[0]",
            "experiment_runs_1.output[0]",
            id="experiment-json-attribute-int-key",
        ),
        pytest.param(
            'experiments[2].reference_output[0]["question"]',
            "dataset_example_revisions.output[0]['question']",
            id="experiment-json-attribute-nested-int-string-keys",
        ),
        # primitive comparison expressions
        pytest.param(
            "error is None",
            "experiment_runs_0.error IS NULL",
            id="is-none",
        ),
        pytest.param(
            "error is not None",
            "experiment_runs_0.error IS NOT NULL",
            id="is-not-none",
        ),
        pytest.param(
            '"invalid" in error',
            "experiment_runs_0.error LIKE '%' || 'invalid' || '%'",  # noqa: E501
            id="contains",
        ),
        pytest.param(
            "error in 'invalid'",
            "'invalid' LIKE '%' || experiment_runs_0.error || '%'",
            id="contains-reversed",
        ),
        pytest.param(
            '"invalid" not in error',
            "experiment_runs_0.error NOT LIKE '%' || 'invalid' || '%'",  # noqa: E501
            id="not-contains",
        ),
        pytest.param(
            "latency_ms > 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1) > 1000",  # noqa: E501
            id="gt",
        ),
        pytest.param(
            "1000 < latency_ms",
            "1000 < round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1)",  # noqa: E501
            id="gt-reversed",
        ),
        pytest.param(
            "latency_ms >= 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1) >= 1000",  # noqa: E501
            id="gte",
        ),
        pytest.param(
            "1000 <= latency_ms",
            "1000 <= round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1)",  # noqa: E501
            id="gte-reversed",
        ),
        pytest.param(
            "latency_ms < 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1) < 1000",  # noqa: E501
            id="lt",
        ),
        pytest.param(
            "1000 > latency_ms",
            "1000 > round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1)",  # noqa: E501
            id="lt-reversed",
        ),
        pytest.param(
            "latency_ms <= 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1) <= 1000",  # noqa: E501
            id="lte",
        ),
        pytest.param(
            "1000 >= latency_ms",
            "1000 >= round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1)",  # noqa: E501
            id="lte-reversed",
        ),
        pytest.param(
            "latency_ms == 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1) = 1000",  # noqa: E501
            id="eq",
        ),
        pytest.param(
            "1000 == latency_ms",
            "1000 = round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1)",  # noqa: E501
            id="eq-reversed",
        ),
        pytest.param(
            "latency_ms != 1000",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1) != 1000",  # noqa: E501
            id="ne",
        ),
        pytest.param(
            "1000 != latency_ms",
            "1000 != round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1)",  # noqa: E501
            id="ne-reversed",
        ),
        # literal comparison
        pytest.param(
            "1 < 1.1",
            "1 < 1.1",
            id="literal-comparison-lt",
        ),
        pytest.param(
            "'a' == 'b'",
            "'a' = 'b'",
            id="literal-comparison-eq",
        ),
        # experiment run attribute comparison expressions
        pytest.param(
            "experiments[2].error is None",
            "experiment_runs_2.error IS NULL",
            id="experiment-error-is-none",
        ),
        pytest.param(
            "experiments[1].error is not None",
            "experiment_runs_1.error IS NOT NULL",
            id="experiment-error-is-not-none",
        ),
        pytest.param(
            "experiments[1].latency_ms > 10",
            "round(CAST((EXTRACT(EPOCH FROM experiment_runs_1.end_time) - EXTRACT(EPOCH FROM experiment_runs_1.start_time)) * 1000 AS NUMERIC), 1) > 10",  # noqa: E501
            id="experiment-latency-gt",
        ),
        # json attribute comparison expressions
        pytest.param(
            'experiments[0].input["score"] > 0.5',
            "CAST(dataset_example_revisions.input['score'] AS FLOAT) > 0.5",  # noqa: E501
            id="experiment-json-attribute-gt",
        ),
        pytest.param(
            'experiments[0].output["confidence"] >= 0.8',
            "CAST(experiment_runs_0.output['confidence'] AS FLOAT) >= 0.8",  # noqa: E501
            id="experiment-json-attribute-gte",
        ),
        pytest.param(
            'experiments[0].input["length"] < 100',
            "CAST(dataset_example_revisions.input['length'] AS FLOAT) < 100",  # noqa: E501
            id="experiment-json-attribute-lt",
        ),
        pytest.param(
            'experiments[1].output["probability"] <= 0.3',
            "CAST(experiment_runs_1.output['probability'] AS FLOAT) <= 0.3",  # noqa: E501
            id="experiment-json-attribute-lte",
        ),
        pytest.param(
            'experiments[1].reference_output["answer"] == "yes"',
            "CAST(dataset_example_revisions.output['answer'] AS VARCHAR) = 'yes'",  # noqa: E501
            id="experiment-json-attribute-eq",
        ),
        pytest.param(
            'experiments[1].output["category"] != "unknown"',
            "CAST(experiment_runs_1.output['category'] AS VARCHAR) != 'unknown'",  # noqa: E501
            id="experiment-json-attribute-ne",
        ),
        pytest.param(
            'experiments[2].output["result"] is None',
            "experiment_runs_2.output['result'] IS NULL",
            id="experiment-json-attribute-is-none",
        ),
        pytest.param(
            'experiments[2].input["metadata"] is not None',
            "dataset_example_revisions.input['metadata'] IS NOT NULL",  # noqa: E501
            id="experiment-json-attribute-is-not-none",
        ),
        pytest.param(
            'experiments[2].reference_output["answer"] == None',
            "dataset_example_revisions.output['answer'] IS NULL",  # noqa: E501
            id="experiment-json-attribute-eq-none",
        ),
        pytest.param(
            'experiments[0].output["category"] != None',
            "experiment_runs_0.output['category'] IS NOT NULL",  # noqa: E501
            id="experiment-json-attribute-ne-none",
        ),
        pytest.param(
            "'search-term' in input['questions'][0]",
            "CAST(dataset_example_revisions.input['questions'][0] AS VARCHAR) LIKE '%' || 'search-term' || '%'",  # noqa: E501
            id="experiment-json-attribute-in",
        ),
        pytest.param(
            "'search-term' not in input['questions'][0]",
            "CAST(dataset_example_revisions.input['questions'][0] AS VARCHAR) NOT LIKE '%' || 'search-term' || '%'",  # noqa: E501
            id="experiment-json-attribute-not-in",
        ),
        pytest.param(
            "input['question'] in output['question']",
            "CAST(experiment_runs_0.output['question'] AS VARCHAR) LIKE '%' || CAST(dataset_example_revisions.input['question'] AS VARCHAR) || '%'",  # noqa: E501
            id="json-attribute-in-json-attribute",
        ),
        pytest.param(
            "output['question'] not in output['question']",
            "CAST(experiment_runs_0.output['question'] AS VARCHAR) NOT LIKE '%' || CAST(experiment_runs_0.output['question'] AS VARCHAR) || '%'",  # noqa: E501
            id="json-attribute-not-in-json-attribute",
        ),
        pytest.param(
            "input['question'] == output['question']",
            "CAST(dataset_example_revisions.input['question'] AS VARCHAR) = CAST(experiment_runs_0.output['question'] AS VARCHAR)",  # noqa: E501
            id="json-attribute-eq-json-attribute",
        ),
        pytest.param(
            "input['question'] != output['question']",
            "CAST(dataset_example_revisions.input['question'] AS VARCHAR) != CAST(experiment_runs_0.output['question'] AS VARCHAR)",  # noqa: E501
            id="json-attribute-ne-json-attribute",
        ),
        pytest.param(
            "input['question'] is output['question']",
            "CAST(dataset_example_revisions.input['question'] AS VARCHAR) IS CAST(experiment_runs_0.output['question'] AS VARCHAR)",  # noqa: E501
            id="json-attribute-is-json-attribute",
        ),
        pytest.param(
            "input['question'] is not output['question']",
            "CAST(dataset_example_revisions.input['question'] AS VARCHAR) IS NOT CAST(experiment_runs_0.output['question'] AS VARCHAR)",  # noqa: E501
            id="json-attribute-is-not-json-attribute",
        ),
        # eval attribute comparison expressions
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5",
            "experiment_run_annotations_0.score > 0.5 AND experiment_run_annotations_0.name = 'Hallucination'",  # noqa: E501
            id="experiment-hallucination-score-gt",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].label == 'hallucinated'",
            "experiment_run_annotations_0.label = 'hallucinated' AND experiment_run_annotations_0.name = 'Hallucination'",  # noqa: E501
            id="experiment-hallucination-label-eq",
        ),
        pytest.param(
            "'search-term' in experiments[0].evals['Hallucination'].explanation",
            "(experiment_run_annotations_0.explanation LIKE '%' || 'search-term' || '%') AND experiment_run_annotations_0.name = 'Hallucination'",  # noqa: E501
            id="experiment-hallucination-explanation-in",
        ),
        # compound expressions
        pytest.param(
            "not experiments[0].evals['Hallucination'].label == 'hallucinated'",
            "NOT (experiment_run_annotations_0.label = 'hallucinated' AND experiment_run_annotations_0.name = 'Hallucination')",  # noqa: E501
            id="negation",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5 and latency_ms > 1000",
            "experiment_run_annotations_0.score > 0.5 AND experiment_run_annotations_0.name = 'Hallucination' AND round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1) > 1000",  # noqa: E501
            id="conjunction",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5 and latency_ms > 1000 and experiments[1].error is None",  # noqa: E501
            "experiment_run_annotations_0.score > 0.5 AND experiment_run_annotations_0.name = 'Hallucination' AND round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1) > 1000 AND experiment_runs_1.error IS NULL",  # noqa: E501
            id="conjunction-of-three",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5 or latency_ms > 1000",
            "experiment_run_annotations_0.score > 0.5 AND experiment_run_annotations_0.name = 'Hallucination' OR round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1) > 1000",  # noqa: E501
            id="disjunction",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5 or latency_ms > 1000 or experiments[1].error is None",  # noqa: E501
            "experiment_run_annotations_0.score > 0.5 AND experiment_run_annotations_0.name = 'Hallucination' OR round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1) > 1000 OR experiment_runs_1.error IS NULL",  # noqa: E501
            id="disjunction-of-three",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5 or latency_ms > 1000 and experiments[1].error is None",  # noqa: E501
            "experiment_run_annotations_0.score > 0.5 AND experiment_run_annotations_0.name = 'Hallucination' OR round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1) > 1000 AND experiment_runs_1.error IS NULL",  # noqa: E501
            id="mixed-conjunction-and-disjunction-without-parentheses",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'].score > 0.5 or (latency_ms > 1000 and experiments[1].error is None)",  # noqa: E501
            "experiment_run_annotations_0.score > 0.5 AND experiment_run_annotations_0.name = 'Hallucination' OR round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1) > 1000 AND experiment_runs_1.error IS NULL",  # noqa: E501
            id="mixed-conjunction-and-disjunction-with-parentheses",
        ),
        pytest.param(
            "not (experiments[0].evals['Hallucination'].score > 0.5 or latency_ms > 1000)",
            "NOT (experiment_run_annotations_0.score > 0.5 AND experiment_run_annotations_0.name = 'Hallucination' OR round(CAST((EXTRACT(EPOCH FROM experiment_runs_0.end_time) - EXTRACT(EPOCH FROM experiment_runs_0.start_time)) * 1000 AS NUMERIC), 1) > 1000)",  # noqa: E501
            id="complex-negation",
        ),
    ),
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


@pytest.mark.parametrize(
    "filter_expression,expected_error_prefix",
    [
        pytest.param(
            "input['question]",
            "unterminated string literal (detected at line 1)",
            id="invalid-python-syntax",
        ),
        pytest.param(
            "latency_ms",
            "Filter condition must be a boolean expression",
            id="not-a-boolean-expression",
        ),
        pytest.param(
            "unknown_name",
            "Unknown name",
            id="unknown-name",
        ),
        pytest.param(
            "input.unknown_attribute",
            "Unknown attribute",
            id="invalid-attribute",
        ),
        pytest.param(
            "latency_ms['key']",
            "Invalid subscript",
            id="invalid-subscript",
        ),
        pytest.param(
            "input[0.5]",
            "Index must be an integer or string",
            id="non-integer-string-index",
        ),
        pytest.param(
            "experiments[input]",
            "Index must be a constant",
            id="non-constant-index",
        ),
        pytest.param(
            "experiments[100].latency_ms < 100",
            "Select an experiment with [<index>]",
            id="experiment-index-out-of-range",
        ),
        pytest.param(
            "experiments['name'].latency_ms < 100",
            "Index to experiments must be an integer",
            id="non-integer-experiment-index",
        ),
        pytest.param(
            "experiments < 0",
            "Select an experiment with [<index>]",
            id="missing-experiment-index",
        ),
        pytest.param(
            "experiments[0] < 0",
            "Add an attribute",
            id="missing-experiment-attribute",
        ),
        pytest.param(
            "experiments[0].evals < 0",
            "Select an eval with [<eval-name>]",
            id="missing-eval-name",
        ),
        pytest.param(
            "evals[0] < 0",
            "Eval must be indexed by string",
            id="non-string-eval-index",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination'] == 'hallucinated'",
            "Choose an attribute for your eval (label, score, etc.)",
            id="missing-eval-attribute",
        ),
        pytest.param(
            "evals['Hallucination'].probability > 0.5",
            "Unknown eval attribute",
            id="unknown-eval-attribute",
        ),
        pytest.param(
            "experiments[0].evals['Hallucination']['score']",
            "Invalid subscript",
            id="forgot-dot-notation-for-eval-attribute",
        ),
        pytest.param(
            "experiments[0].latency_ms < experiments[1].latency_ms < experiments[2].latency_ms",
            "Only binary comparisons are supported",
            id="chained-comparison",
        ),
        pytest.param(
            "not input",
            "Operand must be a boolean expression",
            id="unary-not-on-non-boolean",
        ),
        pytest.param(
            "True and True and True",
            "Boolean operators are binary",
            id="chained-boolean-operation",
        ),
    ],
)
def test_validate_filter_condition_raises_appropriate_error_message(
    filter_expression: str,
    expected_error_prefix: str,
) -> None:
    with pytest.raises(ExperimentRunFilterConditionParseError) as exc_info:
        validate_filter_condition(
            filter_condition=filter_expression,
            experiment_ids=[0, 1, 2],
        )

    error = exc_info.value
    assert str(error).startswith(expected_error_prefix)
