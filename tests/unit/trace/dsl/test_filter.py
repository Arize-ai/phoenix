import ast
import sys
from ast import unparse
from datetime import datetime
from typing import Any, Optional
from unittest.mock import patch
from uuid import UUID

import pytest
from sqlalchemy import insert, select

import phoenix.trace.dsl.filter
from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.filter import (
    Projector,
    SpanFilter,
    _apply_eval_aliasing,
    _get_attribute_keys_list,
)


@pytest.mark.parametrize(
    "expression,expected",
    [
        ("output.value", ["output", "value"]),
        ("llm.token_count.completion", ["llm", "token_count", "completion"]),
        ("attributes['key']", ["key"]),
        ("attributes['a']['b.c'][['d']]", ["a", "b.c", "d"]),
        ("attributes['a'][['b.c']][['d']]", ["a", "b.c", "d"]),
        ("attributes[['a']]['b.c'][['d']]", ["a", "b.c", "d"]),
        ("attributes['a'][['b.c', 'd']]", ["a", "b.c", "d"]),
        ("attributes['a']['b.c'][['d']][0]", ["a", "b.c", "d", 0]),
        ("attributes[['a', 1]]['b.c'][['d']]", ["a", 1, "b.c", "d"]),
        ("attributes[[1, 'a']]['b.c'][['d']]", None),
        ("attributes[0]['b.c'][['d']]", None),
        ("attributes[[0]]['b.c'][['d']]", None),
        ("attributes['a'][[]]['b']", None),
        ("attributes[[]]", None),
        ("attributes[[['a']]]", None),
        ("attributes[None]", None),
        ("attributes['a'][True]", None),
        ("attributes['a'][[True]]", None),
        ("attributes['a'][1+1]", None),
        ("attributes['a'][[1+1]]", None),
        ("metadata['key']", ["metadata", "key"]),
        ("metadata['a']['b.c'][['d']]", ["metadata", "a", "b.c", "d"]),
        ("metadata['a'][['b.c']][['d']]", ["metadata", "a", "b.c", "d"]),
        ("metadata[['a']]['b.c'][['d']]", ["metadata", "a", "b.c", "d"]),
        ("metadata['a'][['b.c', 'd']]", ["metadata", "a", "b.c", "d"]),
        ("metadata['a']['b.c'][['d']][0]", ["metadata", "a", "b.c", "d", 0]),
        ("metadata[['a', 1]]['b.c'][['d']]", ["metadata", "a", 1, "b.c", "d"]),
        ("metadata[[1, 'a']]['b.c'][['d']]", None),
        ("metadata[0]['b.c'][['d']]", None),
        ("metadata[[0]]['b.c'][['d']]", None),
        ("metadata['a'][[]]['b']", None),
        ("metadata[[]]", None),
        ("metadata[[['a']]]", None),
        ("metadata[None]", None),
        ("metadata['a'][True]", None),
        ("metadata['a'][[True]]", None),
        ("metadata['a'][1+1]", None),
        ("metadata['a'][[1+1]]", None),
        ("abc", None),
        ("123", None),
    ],
)
def test_get_attribute_keys_list(expression: str, expected: Optional[list[str]]) -> None:
    actual = _get_attribute_keys_list(
        ast.parse(expression, mode="eval").body,
    )
    if expected is None:
        assert actual is None
    else:
        assert isinstance(actual, list)
        assert [c.value for c in actual] == expected


@pytest.mark.parametrize(
    "expression,expected",
    [
        (
            "parent_id is not None and 'abc' in name or span_kind == 'LLM' and span_id in ('123',)",
            "or_(and_(parent_id != None, TextContains(name, 'abc')), and_(span_kind == 'LLM', span_id.in_(('123',))))"
            if sys.version_info >= (3, 9)
            else "or_(and_((parent_id != None), TextContains(name, 'abc')), and_((span_kind == 'LLM'), span_id.in_(('123',))))",
        ),
        (
            "(parent_id is None or 'abc' not in name) and not (span_kind != 'LLM' or span_id not in ('123',))",
            "and_(or_(parent_id == None, not_(TextContains(name, 'abc'))), not_(or_(span_kind != 'LLM', span_id.not_in(('123',)))))"
            if sys.version_info >= (3, 9)
            else "and_(or_((parent_id == None), not_(TextContains(name, 'abc'))), not_(or_((span_kind != 'LLM'), span_id.not_in(('123',)))))",
        ),
        (
            "1000 < latency_ms < 2000 or status_code == 'ERROR' or 2000 <= cumulative_llm_token_count_total",
            "or_(and_(1000 < latency_ms, latency_ms < 2000), status_code == 'ERROR', 2000 <= cumulative_llm_token_count_total)"
            if sys.version_info >= (3, 9)
            else "or_(and_((1000 < latency_ms), (latency_ms < 2000)), (status_code == 'ERROR'), (2000 <= cumulative_llm_token_count_total))",
        ),
        (
            "llm.token_count.total - llm.token_count.prompt > 1000",
            "attributes[['llm', 'token_count', 'total']].as_float() - attributes[['llm', 'token_count', 'prompt']].as_float() > 1000"
            if sys.version_info >= (3, 9)
            else "((attributes[['llm', 'token_count', 'total']].as_float() - attributes[['llm', 'token_count', 'prompt']].as_float()) > 1000)",
        ),
        (
            "first.value in (1,) and second.value in ('2',) and '3' in third.value",
            "and_(attributes[['first', 'value']].as_float().in_((1,)), attributes[['second', 'value']].as_string().in_(('2',)), TextContains(attributes[['third', 'value']].as_string(), '3'))",
        ),
        (
            "'1.0' < my.value < 2.0",
            "and_('1.0' < attributes[['my', 'value']].as_string(), attributes[['my', 'value']].as_float() < 2.0)"
            if sys.version_info >= (3, 9)
            else "and_(('1.0' < attributes[['my', 'value']].as_string()), (attributes[['my', 'value']].as_float() < 2.0))",
        ),
        (
            "first.value + 1 < second.value",
            "attributes[['first', 'value']].as_float() + 1 < attributes[['second', 'value']].as_float()"
            if sys.version_info >= (3, 9)
            else "((attributes[['first', 'value']].as_float() + 1) < attributes[['second', 'value']].as_float())",
        ),
        (
            "first.value * second.value > third.value",
            "attributes[['first', 'value']].as_float() * attributes[['second', 'value']].as_float() > attributes[['third', 'value']].as_float()"
            if sys.version_info >= (3, 9)
            else "((attributes[['first', 'value']].as_float() * attributes[['second', 'value']].as_float()) > attributes[['third', 'value']].as_float())",
        ),
        (
            "first.value + second.value > third.value",
            "cast(attributes[['first', 'value']].as_string() + attributes[['second', 'value']].as_string(), String) > attributes[['third', 'value']].as_string()"
            if sys.version_info >= (3, 9)
            else "(cast((attributes[['first', 'value']].as_string() + attributes[['second', 'value']].as_string()), String) > attributes[['third', 'value']].as_string())",
        ),
        (
            "my.value == '1.0' or float(my.value) < 2.0",
            "or_(attributes[['my', 'value']].as_string() == '1.0', attributes[['my', 'value']].as_float() < 2.0)"
            if sys.version_info >= (3, 9)
            else "or_((attributes[['my', 'value']].as_string() == '1.0'), (attributes[['my', 'value']].as_float() < 2.0))",
        ),
        (
            "not(-metadata['a.b'] + float(metadata[['c.d']]) != metadata[['e.f', 'g.h']])",
            "not_(-attributes[['metadata', 'a.b']].as_float() + attributes[['metadata', 'c.d']].as_float() != attributes[['metadata', 'e.f', 'g.h']].as_float())"
            if sys.version_info >= (3, 9)
            else "not_((((- attributes[['metadata', 'a.b']].as_float()) + attributes[['metadata', 'c.d']].as_float()) != attributes[['metadata', 'e.f', 'g.h']].as_float()))",
        ),
        (
            "attributes['attributes'] == attributes[['attributes']] != attributes[['attributes', 'attributes']]",
            "and_(attributes[['attributes']].as_string() == attributes[['attributes']].as_string(), attributes[['attributes']].as_string() != attributes[['attributes', 'attributes']].as_string())"
            if sys.version_info >= (3, 9)
            else "and_((attributes[['attributes']].as_string() == attributes[['attributes']].as_string()), (attributes[['attributes']].as_string() != attributes[['attributes', 'attributes']].as_string()))",
        ),
        (
            "metadata['is_empty'] == True",
            "attributes[['metadata', 'is_empty']].as_boolean() == True",
        ),
        (
            "metadata['is_empty'] == False",
            "attributes[['metadata', 'is_empty']].as_boolean() == False",
        ),
        (
            "True == metadata['is_empty']",
            "True == attributes[['metadata', 'is_empty']].as_boolean()",
        ),
        (
            "metadata['is_empty'] is True",
            "attributes[['metadata', 'is_empty']].as_boolean() == True",
        ),
        (
            "metadata['is_empty'] is not False",
            "attributes[['metadata', 'is_empty']].as_boolean() != False",
        ),
        (
            "span_kind == 'chain'",
            "span_kind == 'CHAIN'",
        ),
        (
            "span_kind == 'Chain'",
            "span_kind == 'CHAIN'",
        ),
        (
            "'chain' == span_kind",
            "'CHAIN' == span_kind",
        ),
        (
            "span_kind != 'llm'",
            "span_kind != 'LLM'",
        ),
        (
            "span_kind in ('chain', 'LLM')",
            "span_kind.in_(('CHAIN', 'LLM'))",
        ),
        (
            "span_kind not in ['chain', 'tool']",
            "span_kind.not_in(['CHAIN', 'TOOL'])",
        ),
        (
            "'cha' in span_kind",
            "TextContains(span_kind, 'CHA')",
        ),
        (
            "status_code == 'error'",
            "status_code == 'ERROR'",
        ),
        (
            "'Error' == status_code",
            "'ERROR' == status_code",
        ),
        (
            "status_code in ('ok', 'Error')",
            "status_code.in_(('OK', 'ERROR'))",
        ),
        (
            "'err' in status_code",
            "TextContains(status_code, 'ERR')",
        ),
        # `parent_span` root predicate: `parent_span is None` / `parent_span is not None` become
        # references to correlated EXISTS predicates bound in SpanFilter.__call__.
        (
            "parent_span is None",
            "__parent_is_null__",
        ),
        (
            "parent_span is not None",
            "__parent_is_not_null__",
        ),
        (
            "parent_span == None",
            "__parent_is_null__",
        ),
        (
            "parent_span != None",
            "__parent_is_not_null__",
        ),
        (
            "not (parent_span is None)",
            "not_(__parent_is_null__)",
        ),
    ],
)
async def test_filter_translated(
    db: DbSessionFactory,
    expression: str,
    expected: str,
    default_project: Any,
    abc_project: Any,
) -> None:
    with patch.object(
        phoenix.trace.dsl.filter,
        "uuid4",
        return_value=UUID(hex="00000000000000000000000000000000"),
    ):
        f = SpanFilter(expression)
    assert unparse(f.translated).strip() == expected
    # next line is only to test that the syntax is accepted
    async with db() as session:
        await session.execute(f(select(models.Span.id)))


@pytest.mark.parametrize(
    "filter_condition,expected",
    [
        pytest.param(
            """evals["Q&A Correctness"].label is not None""",
            "span_annotation_0_label_00000000000000000000000000000000 is not None",
            id="double-quoted-eval-name",
        ),
        pytest.param(
            """evals['Q&A Correctness'].label is not None""",
            "span_annotation_0_label_00000000000000000000000000000000 is not None",
            id="single-quoted-eval-name",
        ),
        pytest.param(
            """evals[""].label is not None""",
            "span_annotation_0_label_00000000000000000000000000000000 is not None",
            id="empty-eval-name",
        ),
        pytest.param(
            """evals['Hallucination'].label == 'correct' or evals['Hallucination'].score < 0.5""",
            "span_annotation_0_label_00000000000000000000000000000000 == 'correct' or span_annotation_0_score_00000000000000000000000000000000 < 0.5",
            id="repeated-single-quoted-eval-name",
        ),
        pytest.param(
            """evals["Hallucination"].label == 'correct' or evals["Hallucination"].score < 0.5""",
            "span_annotation_0_label_00000000000000000000000000000000 == 'correct' or span_annotation_0_score_00000000000000000000000000000000 < 0.5",
            id="repeated-double-quoted-eval-name",
        ),
        pytest.param(
            """evals['Hallucination'].label == 'correct' or evals["Hallucination"].score < 0.5""",
            "span_annotation_0_label_00000000000000000000000000000000 == 'correct' or span_annotation_0_score_00000000000000000000000000000000 < 0.5",
            id="repeated-mixed-quoted-eval-name",
        ),
        pytest.param(
            """evals['Q&A Correctness'].label == 'correct' and evals["Hallucination"].score < 0.5""",
            "span_annotation_0_label_00000000000000000000000000000000 == 'correct' and span_annotation_1_score_00000000000000000000000000000000 < 0.5",
            id="distinct-mixed-quoted-eval-names",
        ),
        pytest.param(
            """evals["Hallucination].label is not None""",
            """evals["Hallucination].label is not None""",
            id="missing-right-quotation-mark",
        ),
        pytest.param(
            """evals["Hallucination"].label == 'correct' orevals["Hallucination"].score < 0.5""",
            """span_annotation_0_label_00000000000000000000000000000000 == 'correct' orevals["Hallucination"].score < 0.5""",
            id="no-word-boundary-on-the-left",
        ),
        pytest.param(
            """evals["Hallucination"].scoreq < 0.5""",
            """evals["Hallucination"].scoreq < 0.5""",
            id="no-word-boundary-on-the-right",
        ),
        pytest.param(
            """0.5 <evals["Hallucination"].score""",
            """0.5 <span_annotation_0_score_00000000000000000000000000000000""",
            id="left-word-boundary-without-space",
        ),
        pytest.param(
            """evals["Hallucination"].score< 0.5""",
            """span_annotation_0_score_00000000000000000000000000000000< 0.5""",
            id="right-word-boundary-without-space",
        ),
        pytest.param(
            """annotations["Q&A Correctness"].label is not None""",
            "span_annotation_0_label_00000000000000000000000000000000 is not None",
            id="double-quoted-annotation-name",
        ),
        # Existence checks (bare annotation reference)
        pytest.param(
            """evals['Hallucination']""",
            "span_annotation_0_exists_00000000000000000000000000000000",
            id="bare-evals-exists",
        ),
        pytest.param(
            """annotations['Hallucination']""",
            "span_annotation_0_exists_00000000000000000000000000000000",
            id="bare-annotations-exists",
        ),
    ],
)
def test_apply_eval_aliasing(filter_condition: str, expected: str) -> None:
    with patch.object(
        phoenix.trace.dsl.filter,
        "uuid4",
        return_value=UUID(hex="00000000000000000000000000000000"),
    ):
        aliased, _ = _apply_eval_aliasing(filter_condition)
        assert aliased == expected


class TestProjectorValidationGap:
    """
    Pins the two structural defects in ``Projector`` in
    ``src/phoenix/trace/dsl/filter.py``:

    1. Unlike ``SpanFilter``, ``Projector`` does NOT call
       ``_validate_expression``. It only runs ``_ProjectionTranslator.visit()``,
       which leaves many AST constructs unchecked.
    2. The ``eval()`` namespace is ``{**_NAMES}`` — it does not pin
       ``__builtins__`` to ``{}``, so Python auto-populates the full
       builtins dict into the namespace.

    These tests assert that ``Projector`` rejects dangerous inputs the
    same way ``SpanFilter`` does, and that the eval namespace is
    sandboxed. They are expected to FAIL on the current code,
    demonstrating the vulnerability.
    """

    def test_projector_rejects_what_spanfilter_rejects(self) -> None:
        # ``SpanFilter`` rejects this via ``_validate_expression`` — but
        # ``Projector`` accepts it because it has no equivalent validation.
        # An attacker who reaches the projection code path (e.g. via the
        # SpanQuery REST/GraphQL projection key) can submit arbitrary AST
        # shapes that bypass the structural guardrails ``SpanFilter`` enforces.
        dangerous_expression = "10 ** 100000000"

        with pytest.raises(SyntaxError):
            SpanFilter(dangerous_expression)

        # This assertion FAILS on current code: ``Projector`` happily
        # compiles the unbounded-exponent expression with no validation.
        with pytest.raises(SyntaxError):
            Projector(dangerous_expression)

    def test_projector_eval_namespace_has_no_builtins_access(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # ``Projector.__call__`` evaluates the compiled AST inside an ``eval``
        # call. The eval namespace must pin ``__builtins__`` to ``{}``;
        # otherwise CPython auto-populates the full builtins dict, exposing
        # ``__import__``, ``open``, ``exec``, ``eval``, etc. to anything that
        # survives the AST translator.
        projector = Projector("name")

        captured_globals: list[dict[str, Any]] = []
        real_eval = eval

        def spy_eval(code: Any, globals_dict: dict[str, Any], locals_dict: Any = None) -> Any:
            captured_globals.append(globals_dict)
            return real_eval(code, globals_dict, locals_dict)

        # Inject the spy into the module's namespace; Python looks up bare
        # ``eval`` in module globals before falling back to builtins, so this
        # intercepts the call inside ``Projector.__call__``.
        monkeypatch.setattr("phoenix.trace.dsl.filter.eval", spy_eval, raising=False)
        projector()

        assert len(captured_globals) == 1
        builtins_obj = captured_globals[0].get("__builtins__")
        assert builtins_obj == {}, (
            "Projector eval namespace must pin __builtins__ to {} to prevent "
            "code-injection vectors; instead it exposes "
            f"{len(builtins_obj) if builtins_obj else 0} builtins."
        )


_PARENT_PREDICATE_TS = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")


@pytest.fixture
async def parent_predicate_project(db: DbSessionFactory) -> None:
    """
    A project whose single trace exercises every parent case:

    - ``A`` root span (``parent_id`` is NULL)
    - ``B`` child of ``A``
    - ``C`` orphan (``parent_id`` ``"GHOST"`` references a span absent from the table)
    - ``D`` child of the orphan ``C``
    """
    async with db() as session:
        project_rowid = await session.scalar(
            insert(models.Project).values(name="parent-predicate").returning(models.Project.id)
        )
        trace_rowid = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace-parent-predicate",
                project_rowid=project_rowid,
                start_time=_PARENT_PREDICATE_TS,
                end_time=_PARENT_PREDICATE_TS,
            )
            .returning(models.Trace.id)
        )
        for span_id, parent_id, span_kind in (
            ("A", None, "CHAIN"),
            ("B", "A", "LLM"),
            ("C", "GHOST", "LLM"),
            ("D", "C", "LLM"),
        ):
            await session.execute(
                insert(models.Span).values(
                    trace_rowid=trace_rowid,
                    span_id=span_id,
                    parent_id=parent_id,
                    name=span_id,
                    span_kind=span_kind,
                    start_time=_PARENT_PREDICATE_TS,
                    end_time=_PARENT_PREDICATE_TS,
                    attributes={},
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )


@pytest.mark.parametrize(
    "condition,expected",
    [
        # `parent_span is None` is orphan-aware: both the NULL-parent root and the orphan.
        ("parent_span is None", ["A", "C"]),
        ("parent_span is not None", ["B", "D"]),
        # `parent_id is None` stays strict (NULL pointer only), unchanged by this work.
        ("parent_id is None", ["A"]),
        ("parent_span is None and span_kind == 'LLM'", ["C"]),
        ("parent_span is not None or parent_id is None", ["A", "B", "D"]),
    ],
)
async def test_parent_root_predicate_selects_expected_spans(
    db: DbSessionFactory,
    parent_predicate_project: None,
    condition: str,
    expected: list[str],
) -> None:
    f = SpanFilter(condition)
    async with db() as session:
        span_ids = list(
            await session.scalars(f(select(models.Span.span_id)).order_by(models.Span.span_id))
        )
    assert span_ids == expected


@pytest.mark.parametrize(
    "condition",
    [
        "parent_span",  # bare keyword, not a comparison
        "parent_span == 'LLM'",  # compared to a non-None value
        "parent_span and span_kind == 'LLM'",  # used outside a None comparison
        "parent_span < None",  # unsupported operator with None
        # `parent.<field>` traversal is not supported yet; the reserved keyword is
        # fully locked down, so these must raise rather than silently resolve to
        # the pre-existing `attributes['parent_span'][...]` attribute path.
        "parent_span.span_kind == 'AGENT'",
        "parent_span.name == 'x'",
        "parent_span.a.b.c == 'z'",
        "parent_span.attributes['x'] == 'y'",
        "'x' in parent_span.name",
    ],
)
def test_parent_keyword_rejects_unsupported_usage(condition: str) -> None:
    with pytest.raises(SyntaxError):
        SpanFilter(condition)


def test_attribute_named_parent_span_still_reachable_explicitly() -> None:
    # Reserving `parent_span` does not remove access to a span attribute literally
    # named `parent_span`: it is still reachable via the explicit subscript form,
    # whose root is `attributes`, not the `parent_span` keyword.
    SpanFilter("attributes['parent_span'] == 'x'")  # does not raise


@pytest.mark.parametrize(
    "sentinel",
    ["__parent_is_null__", "__parent_is_not_null__"],
)
def test_parent_predicate_sentinels_unreachable_from_user_input(sentinel: str) -> None:
    """The names bound to the root-existence predicates in the eval namespace must
    not be reachable from user input. Because the translator rewrites every
    non-reserved bare identifier into an ``attributes[[...]]`` subscript before
    compilation, a user who types a sentinel name gets an ordinary attribute
    lookup, never the injected predicate. This locks that invariant so later
    translator changes (e.g. parent-column traversal) cannot regress it.
    """
    translated = unparse(SpanFilter(f"{sentinel} == 'x'").translated).strip()
    # resolves to an attribute path, not the bare injected name
    assert translated.startswith(f"attributes[['{sentinel}']]")
