import ast
import logging
import re
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
            "Subscript key must be a literal",
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
        # A comparison between two *known* types needs no cast, and nothing used
        # to check the two were comparable -- so the mismatch reached the
        # database as written and PostgreSQL rejected it (`double precision =
        # varchar`, `varchar = integer`) after the condition had already been
        # reported valid.
        pytest.param(
            "evals['x'].score == ''",
            "cannot compare number and string",
            id="eval-score-compared-to-string",
        ),
        pytest.param(
            "latency_ms > ''",
            "cannot compare number and string",
            id="latency-compared-to-string",
        ),
        pytest.param(
            "evals['x'].label == 100",
            "cannot compare string and number",
            id="eval-label-compared-to-number",
        ),
        pytest.param(
            "evals['x'].score == True",
            "cannot compare number and boolean",
            id="eval-score-compared-to-boolean",
        ),
        # `X IS Y` between two non-singleton expressions is a PostgreSQL syntax
        # error; SQLite accepts it. These previously compiled and were snapshot
        # tested, but the recorded PostgreSQL SQL could never have run.
        pytest.param(
            "experiments[0].input['question'] is experiments[0].output['question']",
            "`is` is only supported with None, True, or False",
            id="is-between-json-attributes",
        ),
        pytest.param(
            "experiments[0].input['question'] is not experiments[0].output['question']",
            "`is` is only supported with None, True, or False",
            id="is-not-between-json-attributes",
        ),
        pytest.param(
            "input and error",
            "Operands of `and` / `or` must be boolean expressions",
            id="json-attribute-as-and-operand",
        ),
        # PostgreSQL rejects `-'hello'` as an ambiguous operator and SQLite
        # coerces it to 0. This compiled and was snapshot tested; the recorded
        # PostgreSQL SQL could never have run.
        pytest.param(
            "-'hello' < 10",
            "Unary minus requires a numeric operand",
            id="unary-minus-on-text",
        ),
        pytest.param(
            "latency_ms > 1 and input",
            "Operands of `and` / `or` must be boolean expressions",
            id="json-attribute-as-second-and-operand",
        ),
        pytest.param(
            "error == 1",
            "cannot compare string and number",
            id="error-compared-to-number",
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
    "filter_condition",
    [
        pytest.param("latency_ms ** 2 > 1", id="unsupported-binary-operator"),
        pytest.param("error == b'abc'", id="bytes-literal"),
        pytest.param("latency_ms == 1j", id="complex-literal"),
        pytest.param("error == ...", id="ellipsis-literal"),
        pytest.param("error == ('a','b')", id="tuple-comparand"),
        pytest.param("error in [['a']]", id="nested-container"),
        pytest.param("1 in [1, 2]", id="literal-membership"),
        pytest.param("not (" * 400 + "latency_ms > 1" + ")" * 400, id="deeply-nested"),
    ],
)
def test_compile_sqlalchemy_filter_condition_reports_every_failure_as_a_filter_error(
    filter_condition: str,
) -> None:
    """No condition may fail with an exception type callers do not expect.

    Validation happens during construction rather than as a pass over the tree,
    so an expression can reach a branch no node anticipated and raise whatever
    Python raises there -- `AssertionError` from `assert_never`, `TypeError`
    from an operation applied to the wrong shape. Callers catch only
    `ExperimentRunFilterConditionSyntaxError`, so anything else reaches the user
    as a server error rather than an invalid-filter message.
    """
    with pytest.raises(ExperimentRunFilterConditionSyntaxError):
        compile_sqlalchemy_filter_condition(
            filter_condition=filter_condition,
            experiment_ids=[0, 1, 2],
        )


def test_caller_errors_are_not_reported_as_filter_errors() -> None:
    """An empty experiment list is a contract violation by the caller, not
    something a user typed. Converting it to a filter error would tell the user
    their condition is invalid to cover for our bug."""
    with pytest.raises(ValueError) as exc_info:
        compile_sqlalchemy_filter_condition(filter_condition="latency_ms > 1", experiment_ids=[])
    assert not isinstance(exc_info.value, ExperimentRunFilterConditionSyntaxError)


@pytest.mark.parametrize(
    "filter_condition",
    [
        pytest.param("latency_ms in [1]", id="list"),
        pytest.param("latency_ms in (1, 2)", id="tuple"),
        pytest.param("error in ['a', 'b']", id="string-list"),
    ],
)
def test_unsupported_membership_says_what_is_unsupported(filter_condition: str) -> None:
    """There is no node type for a collection, so these used to reach
    compilation and fail with `'Constant' object is not iterable`, which the
    boundary then reported as `Invalid filter condition` -- telling the user a
    reasonable filter was wrong rather than unimplemented."""
    with pytest.raises(ExperimentRunFilterConditionSyntaxError, match="not supported"):
        compile_sqlalchemy_filter_condition(filter_condition=filter_condition, experiment_ids=[0])


def test_compile_sqlalchemy_filter_condition_does_not_leak_internal_messages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An unanticipated failure is reported as a filter error, not a fault.

    `assert_never` reports that our code believed a branch unreachable, and a
    raw `AttributeError` names an internal type; both describe the
    implementation rather than the user's condition.

    The failure is injected rather than triggered by some construct that
    happens to be unhandled today. This boundary exists for gaps we do not know
    about, so any input chosen to reach it stops reaching it the moment that gap
    is closed -- which is how this test came to assert the old, worse message
    for `b'abc'` after the surface validator started naming it.
    """

    def explode(*args: Any, **kwargs: Any) -> Any:
        raise AttributeError("'Constant' object has no attribute 'compile'")

    monkeypatch.setattr(SQLAlchemyTransformer, "visit", explode)
    with pytest.raises(ExperimentRunFilterConditionSyntaxError) as exc_info:
        compile_sqlalchemy_filter_condition(
            filter_condition="error == 'boom'",
            experiment_ids=[0],
        )
    assert str(exc_info.value) == "Invalid filter condition"


@pytest.mark.parametrize(
    "filter_condition",
    [
        pytest.param("evals['x'].score > 0.5", id="number-vs-float"),
        pytest.param("evals['x'].score > 1", id="number-vs-int"),
        pytest.param("latency_ms > 1000", id="latency-vs-number"),
        pytest.param("evals['x'].label == 'good'", id="string-vs-string"),
        pytest.param("error == 'boom'", id="error-vs-string"),
        # NULL is comparable to anything
        pytest.param("evals['x'].label is None", id="string-vs-null"),
        pytest.param("evals['x'].score is None", id="number-vs-null"),
        # a JSON attribute has no type until the rows are read, so the cast
        # heuristics still apply and nothing is rejected up front
        pytest.param("input['x'] == 'y'", id="unknown-vs-string"),
        pytest.param("input['x'] > 5", id="unknown-vs-number"),
        pytest.param("output['a'] == input['b']", id="unknown-vs-unknown"),
        pytest.param("'a' in evals['x'].explanation", id="containment"),
    ],
)
def test_compile_sqlalchemy_filter_condition_accepts_comparable_types(
    filter_condition: str,
) -> None:
    """The type check must not narrow what was already valid.

    Integers and floats are one family, NULL compares to anything, and an
    operand whose type is unknown until the rows are read is left to the cast
    heuristics rather than rejected.
    """
    compile_sqlalchemy_filter_condition(
        filter_condition=filter_condition,
        experiment_ids=[0, 1, 2],
    )  # does not raise


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


class TestInheritedPythonSurface:
    """Constructs `ast.parse` admits that this language never implemented.

    Each of these used to reach the transformer, fail with whatever Python
    raised at the point of contact, and be reported as "Invalid filter
    condition" with a stack trace logged at error level -- a typo presented as a
    server fault. The message must name what the user typed.
    """

    @pytest.mark.parametrize(
        "condition,expected",
        [
            pytest.param("error == b'abc'", "Unsupported literal: `b'abc'`", id="bytes"),
            pytest.param("error == ...", "Unsupported literal: `...`", id="ellipsis"),
            pytest.param("error == 1j", "Unsupported literal: `1j`", id="complex"),
            pytest.param("error == 1e400", "Invalid numeric literal: `1e309`", id="non-finite"),
            pytest.param(
                r"error == 'a\x00b'",
                "String literals cannot contain a NUL character",
                id="nul-in-literal",
            ),
            pytest.param(
                "latency_ms ** 2 > 1",
                "Arithmetic is not supported here: `latency_ms ** 2`",
                id="power",
            ),
            pytest.param(
                "latency_ms + 1 > 1",
                "Arithmetic is not supported here: `latency_ms + 1`",
                id="add",
            ),
            pytest.param(
                "latency_ms | 2 > 1",
                "Arithmetic is not supported here: `latency_ms | 2`",
                id="bitwise-or",
            ),
            pytest.param("~latency_ms > 1", "Unsupported operator: `~latency_ms`", id="invert"),
            pytest.param("+latency_ms > 1", "Unsupported operator: `+latency_ms`", id="unary-plus"),
            pytest.param("{'a': 1} == error", "Unsupported collection: `{'a': 1}`", id="dict"),
            pytest.param("{1, 2} == error", "Unsupported collection: `{1, 2}`", id="set"),
            pytest.param("input[1:2] == 'a'", "Slicing is not supported", id="slice"),
            pytest.param(
                "input[f'x'] == 'a'", "Formatted strings are not supported", id="fstring-key"
            ),
            pytest.param("f'{error}' == 'a'", "Formatted strings are not supported", id="fstring"),
            pytest.param("await error == 'a'", "Unsupported expression: `await error`", id="await"),
            pytest.param(
                "(lambda: 1)() == 1", "Function calls are not supported", id="called-lambda"
            ),
            pytest.param(
                "[x for x in [1]][0] == 1", "Comprehensions are not supported", id="comprehension"
            ),
            pytest.param(
                "(error if 1 else error) == 'a'",
                "Unsupported expression",
                id="conditional-expression",
            ),
            pytest.param(
                "input[-1] == 'a'", "Subscript key must be a literal: `-1`", id="negative-index"
            ),
            # `bool` is an `int` subclass, so these used to be read as index 1.
            pytest.param(
                "input[True] == 'a'", "Index must be an integer or string", id="bool-index"
            ),
            pytest.param(
                "experiments[True].error == 'a'",
                "Index to experiments must be an integer",
                id="bool-experiment-index",
            ),
            pytest.param(
                "experiments[0].evals[1].score > 1",
                "Eval must be indexed by string",
                id="non-string-eval-name",
            ),
        ],
    )
    def test_rejected_with_a_message_naming_the_construct(
        self, condition: str, expected: str
    ) -> None:
        with pytest.raises(ExperimentRunFilterConditionSyntaxError, match=re.escape(expected)):
            compile_sqlalchemy_filter_condition(filter_condition=condition, experiment_ids=[1])

    def test_nul_in_the_source_is_not_a_server_error(self) -> None:
        # `ast.parse` reports this as a `ValueError`, which callers do not
        # catch, so it escaped the boundary that turns input into filter errors.
        with pytest.raises(
            ExperimentRunFilterConditionSyntaxError, match="cannot contain a NUL character"
        ):
            compile_sqlalchemy_filter_condition(
                filter_condition="error == 'a\x00b'", experiment_ids=[1]
            )

    def test_rejection_does_not_log_an_error(self, caplog: pytest.LogCaptureFixture) -> None:
        # The catch-all logs with a traceback, which is right for a gap we do
        # not know about and wrong for a construct we have decided to reject.
        with caplog.at_level(logging.ERROR):
            for condition in (
                "error == b'abc'",
                "latency_ms ** 2 > 1",
                "~latency_ms > 1",
                "input[1:2] == 'a'",
                "input[f'x'] == 'a'",
                "input[-1] == 'a'",
                "await error == 'a'",
                "(lambda: 1)() == 1",
            ):
                with pytest.raises(ExperimentRunFilterConditionSyntaxError):
                    compile_sqlalchemy_filter_condition(
                        filter_condition=condition, experiment_ids=[1]
                    )
        assert not caplog.records

    def test_supported_arithmetic_still_compiles(self) -> None:
        compile_sqlalchemy_filter_condition(filter_condition="-latency_ms > 1", experiment_ids=[1])
