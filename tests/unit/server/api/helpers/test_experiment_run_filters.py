import ast
import sys
from typing import Any

import pytest
from syrupy.assertion import SnapshotAssertion

from phoenix.server.api.helpers.experiment_run_filters import (
    ExperimentRunFilterConditionSyntaxError,
    FreeAttributeNameBinder,
    SQLAlchemyTransformer,
    compile_sqlalchemy_filter_condition,
)


@pytest.mark.parametrize(
    "filter_condition",
    (
        # primitive names
        pytest.param(
            "1",
            id="int-constant",
        ),
        pytest.param(
            "'foo'",
            id="string-constant",
        ),
        # experiment run attributes
        pytest.param(
            "experiments[0].input",
            id="experiment-input-name",
        ),
        pytest.param(
            "experiments[0].reference_output",
            id="experiment-reference-output-name",
        ),
        pytest.param(
            "experiments[0].metadata",
            id="experiment-metadata-name",
        ),
        pytest.param(
            "experiments[1].output",
            id="experiment-output-name",
        ),
        pytest.param(
            "experiments[1].error",
            id="experiment-error-name",
        ),
        pytest.param(
            "experiments[2].latency_ms",
            id="experiment-latency-ms-name",
        ),
        # json attributes
        pytest.param(
            'experiments[0].input["question"]',
            id="experiment-json-attribute-string-key",
        ),
        pytest.param(
            "experiments[1].output[0]",
            id="experiment-json-attribute-int-key",
        ),
        pytest.param(
            'experiments[2].reference_output[0]["question"]',
            id="experiment-json-attribute-nested-int-string-keys",
        ),
        # primitive comparison expressions
        pytest.param(
            "experiments[0].error is None",
            id="is-none",
        ),
        pytest.param(
            "experiments[0].error is not None",
            id="is-not-none",
        ),
        pytest.param(
            '"invalid" in experiments[0].error',
            id="contains",
        ),
        pytest.param(
            "experiments[0].error in 'invalid'",
            id="contains-reversed",
        ),
        pytest.param(
            '"invalid" not in experiments[0].error',
            id="not-contains",
        ),
        pytest.param(
            "experiments[0].latency_ms > 1000",
            id="gt",
        ),
        pytest.param(
            "1000 < experiments[0].latency_ms",
            id="gt-reversed",
        ),
        pytest.param(
            "experiments[0].latency_ms >= 1000",
            id="gte",
        ),
        pytest.param(
            "1000 <= experiments[0].latency_ms",
            id="gte-reversed",
        ),
        pytest.param(
            "experiments[0].latency_ms < 1000",
            id="lt",
        ),
        pytest.param(
            "1000 > experiments[0].latency_ms",
            id="lt-reversed",
        ),
        pytest.param(
            "experiments[0].latency_ms <= 1000",
            id="lte",
        ),
        pytest.param(
            "1000 >= experiments[0].latency_ms",
            id="lte-reversed",
        ),
        pytest.param(
            "experiments[0].latency_ms == 1000",
            id="eq",
        ),
        pytest.param(
            "1000 == experiments[0].latency_ms",
            id="eq-reversed",
        ),
        pytest.param(
            "experiments[0].latency_ms != 1000",
            id="ne",
        ),
        pytest.param(
            "1000 != experiments[0].latency_ms",
            id="ne-reversed",
        ),
        # literal comparison
        pytest.param(
            "1 < 1.1",
            id="literal-comparison-lt",
        ),
        pytest.param(
            "'a' == 'b'",
            id="literal-comparison-eq",
        ),
        # json attribute comparison expressions
        pytest.param(
            'experiments[0].input["score"] > 0.5',
            id="experiment-json-attribute-gt",
        ),
        pytest.param(
            'experiments[0].output["confidence"] >= 0.8',
            id="experiment-json-attribute-gte",
        ),
        pytest.param(
            'experiments[0].input["length"] < 100',
            id="experiment-json-attribute-lt",
        ),
        pytest.param(
            'experiments[1].output["probability"] <= 0.3',
            id="experiment-json-attribute-lte",
        ),
        pytest.param(
            'experiments[1].reference_output["answer"] == "yes"',
            id="experiment-json-attribute-eq",
        ),
        pytest.param(
            'experiments[1].metadata["category"] != "hard_question"',
            id="experiment-json-attribute-ne",
        ),
        pytest.param(
            'experiments[2].output["result"] is None',
            id="experiment-json-attribute-is-none",
        ),
        pytest.param(
            'experiments[2].input["metadata"] is not None',
            id="experiment-json-attribute-is-not-none",
        ),
        pytest.param(
            'experiments[2].reference_output["answer"] == None',
            id="experiment-json-attribute-eq-none",
        ),
        pytest.param(
            'experiments[0].output["category"] != None',
            id="experiment-json-attribute-ne-none",
        ),
        pytest.param(
            "'search-term' in experiments[0].input['questions'][0]",
            id="experiment-json-attribute-in",
        ),
        pytest.param(
            "'search-term' not in experiments[0].input['questions'][0]",
            id="experiment-json-attribute-not-in",
        ),
        pytest.param(
            "'%_' in experiments[0].output",
            id="special-characters-in-attribute-escaped",
        ),
        pytest.param(
            "experiments[0].input['question'] in experiments[0].output['question']",
            id="json-attribute-in-json-attribute",
        ),
        pytest.param(
            "experiments[0].output['question'] not in experiments[0].output['question']",
            id="json-attribute-not-in-json-attribute",
        ),
        pytest.param(
            "experiments[0].input['question'] == experiments[0].output['question']",
            id="json-attribute-eq-json-attribute",
        ),
        pytest.param(
            "experiments[0].input['question'] != experiments[0].output['question']",
            id="json-attribute-ne-json-attribute",
        ),
        pytest.param(
            "experiments[0].input['question'] is experiments[0].output['question']",
            id="json-attribute-is-json-attribute",
        ),
        pytest.param(
            "experiments[0].input['question'] is not experiments[0].output['question']",
            id="json-attribute-is-not-json-attribute",
        ),
        # eval attribute comparison expressions
        pytest.param(
            "experiments[0].evals['hallucination'].score > 0.5",
            id="experiment-hallucination-score-gt",
        ),
        pytest.param(
            "experiments[0].evals['hallucination'].label == 'hallucinated'",
            id="experiment-hallucination-label-eq",
        ),
        pytest.param(
            "'search-term' in experiments[0].evals['hallucination'].explanation",
            id="experiment-hallucination-explanation-in",
        ),
        # compound expressions
        pytest.param(
            "not experiments[0].evals['hallucination'].label == 'hallucinated'",
            id="negation",
        ),
        pytest.param(
            "experiments[0].evals['hallucination'].score > 0.5 and experiments[0].latency_ms > 1000",
            id="conjunction",
        ),
        pytest.param(
            "experiments[0].evals['hallucination'].score > 0.5 and experiments[0].latency_ms > 1000 and experiments[1].error is None",
            id="conjunction-of-three",
        ),
        pytest.param(
            "experiments[0].evals['hallucination'].score > 0.5 or experiments[0].latency_ms > 1000",
            id="disjunction",
        ),
        pytest.param(
            "experiments[0].evals['hallucination'].score > 0.5 or experiments[0].latency_ms > 1000 or experiments[1].error is None",
            id="disjunction-of-three",
        ),
        pytest.param(
            "experiments[0].evals['hallucination'].score > 0.5 or experiments[0].latency_ms > 1000 and experiments[1].error is None",
            id="mixed-conjunction-and-disjunction-without-parentheses",
        ),
        pytest.param(
            "experiments[0].evals['hallucination'].score > 0.5 or (experiments[0].latency_ms > 1000 and experiments[1].error is None)",
            id="mixed-conjunction-and-disjunction-with-parentheses",
        ),
        pytest.param(
            "not (experiments[0].evals['hallucination'].score > 0.5 or experiments[0].latency_ms > 1000)",
            id="complex-negation",
        ),
        # unary operations
        pytest.param(
            "-5",
            id="unary-minus-constant",
        ),
        pytest.param(
            "-experiments[0].latency_ms",
            id="unary-minus-attribute",
        ),
        pytest.param(
            "-experiments[0].latency_ms > -5",
            id="unary-minus-comparison",
        ),
        # weird cases
        pytest.param(
            "-'hello' < 10",
            id="unary-minus-string-comparison",
        ),
    ),
)
def test_sqlalchemy_transformer_correctly_compiles(
    filter_condition: str, sqlalchemy_dialect: Any, snapshot: SnapshotAssertion
) -> None:
    tree = ast.parse(filter_condition, mode="eval")
    transformer = SQLAlchemyTransformer([0, 1, 2])
    transformed_tree = transformer.visit(tree)
    node = transformed_tree.body
    sqlalchemy_filter_condition = node.compile()
    sql = str(
        sqlalchemy_filter_condition.compile(
            compile_kwargs={"literal_binds": True}, dialect=sqlalchemy_dialect
        )
    )
    snapshot.assert_match(
        {
            "filter_condition": filter_condition,
            "sql": sql,
        }
    )


@pytest.mark.parametrize(
    "filter_condition",
    (
        pytest.param(
            "5 == 5",
            id="no-free-attributes",
        ),
        pytest.param(
            "input['score'] < 10",
            id="input-is-not-free-attribute",
        ),
        pytest.param(
            "reference_output['score'] < 10",
            id="reference-output-is-not-free-attribute",
        ),
        pytest.param(
            "metadata['category'] == 'hard_questions'",
            id="metadata-is-not-free-attribute",
        ),
        pytest.param(
            "output['score'] < 10",
            id="output-is-not-free-attribute",
        ),
        pytest.param(
            "'invalid' in error",
            id="error-is-not-free-attribute",
        ),
        pytest.param(
            "latency_ms < 1000",
            id="latency-ms-is-not-free-attribute",
        ),
        pytest.param(
            "evals['hallucination'].score < 10",
            id="eval-comparison",
        ),
    ),
)
def test_compile_sqlalchemy_filter_condition_correctly_compiles(
    filter_condition: str, sqlalchemy_dialect: Any, snapshot: SnapshotAssertion
) -> None:
    sqlalchemy_filter_condition, _ = compile_sqlalchemy_filter_condition(
        filter_condition=filter_condition,
        experiment_ids=[0, 1],
    )
    sql = str(
        sqlalchemy_filter_condition.compile(
            compile_kwargs={"literal_binds": True}, dialect=sqlalchemy_dialect
        )
    )
    snapshot.assert_match(
        {
            "filter_condition": filter_condition,
            "sql": sql,
        }
    )


@pytest.mark.parametrize(
    "filter_condition,expected_error_prefix",
    [
        pytest.param(
            "input['question]",
            "EOL while scanning string literal"
            if sys.version_info < (3, 10)
            else "unterminated string literal (detected at line 1)",
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
            "experiments[0].evals['hallucination'] == 'hallucinated'",
            "Choose an attribute for your eval (label, score, etc.)",
            id="missing-eval-attribute",
        ),
        pytest.param(
            "evals['hallucination'].probability > 0.5",
            "Unknown eval attribute",
            id="unknown-eval-attribute",
        ),
        pytest.param(
            "experiments[0].evals['hallucination']['score']",
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
    ],
)
def test_compile_sqlalchemy_filter_condition_raises_appropriate_error_message(
    filter_condition: str,
    expected_error_prefix: str,
) -> None:
    with pytest.raises(ExperimentRunFilterConditionSyntaxError) as exc_info:
        compile_sqlalchemy_filter_condition(
            filter_condition=filter_condition,
            experiment_ids=[0, 1, 2],
        )

    error = exc_info.value
    assert str(error).startswith(expected_error_prefix)


@pytest.mark.parametrize(
    "input_expression,experiment_index,expected_output_expression,expected_binds_free_attribute_name",
    [
        pytest.param(
            "input",
            0,
            "input",
            False,
            id="input-attribute",
        ),
        pytest.param(
            "output",
            7,
            "experiments[7].output",
            True,
            id="output-attribute",
        ),
        pytest.param(
            "reference_output",
            13,
            "reference_output",
            False,
            id="reference-output-attribute",
        ),
        pytest.param(
            "error",
            99,
            "experiments[99].error",
            True,
            id="error-attribute",
        ),
        pytest.param(
            "latency_ms",
            3,
            "experiments[3].latency_ms",
            True,
            id="latency-ms-attribute",
        ),
        pytest.param(
            "evals",
            21,
            "experiments[21].evals",
            True,
            id="evals-attribute",
        ),
        # Test cases for unsupported names (should remain unchanged)
        pytest.param(
            "unknown_name",
            42,
            "unknown_name",
            False,
            id="unsupported-name",
        ),
        pytest.param(
            "True",
            42,
            "True",
            False,
            id="boolean-literal",
        ),
        pytest.param(
            "None",
            42,
            "None",
            False,
            id="none-literal",
        ),
        pytest.param(
            "output > 5",
            55,
            "experiments[55].output > 5",
            True,
            id="comparison-expression-with-output-attribute",
        ),
        pytest.param(
            "x > 5",
            42,
            "x > 5",
            False,
            id="comparison-expression-with-unknown-name",
        ),
        pytest.param(
            "x > 5 and output > 5",
            33,
            "x > 5 and experiments[33].output > 5",
            True,
            id="boolean-expression",
        ),
    ],
)
def test_free_attribute_name_binder_produces_correct_output(
    input_expression: str,
    experiment_index: int,
    expected_output_expression: str,
    expected_binds_free_attribute_name: bool,
) -> None:
    input_tree = ast.parse(input_expression, mode="eval")
    binder = FreeAttributeNameBinder(experiment_index=experiment_index)
    transformed_tree = binder.visit(input_tree)
    assert binder.binds_free_attribute_name == expected_binds_free_attribute_name
    transformed_expr = ast.unparse(transformed_tree)
    assert transformed_expr == expected_output_expression
