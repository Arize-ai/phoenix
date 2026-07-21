import ast
import random
import sys
import typing
from ast import unparse
from collections import Counter
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
    RootSpanScope,
    SpanFilter,
    _apply_eval_aliasing,
    _get_attribute_keys_list,
    root_span_scope,
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


@pytest.mark.parametrize(
    "condition,expected",
    [
        pytest.param("", None, id="empty"),
        pytest.param("parent_span is None", "orphan_aware", id="orphan-aware"),
        pytest.param("parent_id is None", "strict", id="strict"),
        pytest.param("parent_span == None", "orphan_aware", id="eq-spelling"),
        pytest.param("None is parent_span", "orphan_aware", id="reversed-operands"),
        pytest.param("span_kind == 'LLM'", None, id="unrelated-condition"),
        pytest.param(
            "parent_span is None and span_kind == 'LLM'",
            "orphan_aware",
            id="leading-conjunct",
        ),
        pytest.param(
            "span_kind == 'LLM' and parent_id is None",
            "strict",
            id="trailing-conjunct",
        ),
        pytest.param(
            "(span_kind == 'LLM' and parent_span is None) and latency_ms > 5",
            "orphan_aware",
            id="nested-conjunct",
        ),
        # Conjoined restrictions compound, so the narrower one is what the
        # condition actually selects.
        pytest.param(
            "parent_span is None and parent_id is None",
            "strict",
            id="both-predicates-narrowest-wins",
        ),
        # A root predicate under `or` leaves non-root spans in the result set,
        # so the condition imposes no root restriction at all.
        pytest.param("parent_span is None or span_kind == 'LLM'", None, id="disjunction"),
        pytest.param("not (parent_span is None)", None, id="negation"),
        pytest.param("parent_span is not None", None, id="non-root-predicate"),
        # An in-progress edit must not raise.
        pytest.param("span_kind == 'LLM' and", None, id="unparseable"),
    ],
)
def test_root_span_scope_reports_what_the_condition_restricts_to(
    condition: str,
    expected: typing.Optional[RootSpanScope],
) -> None:
    assert root_span_scope(condition) == expected


@pytest.mark.parametrize(
    "condition,expected",
    [
        # Every branch of the disjunction is root-scoped, so every matching row
        # is a root span even though no single conjunct binds the whole
        # expression.
        pytest.param(
            "(parent_id is None and span_kind == 'LLM') or (parent_id is None and latency_ms > 5)",
            "strict",
            id="all-branches-strict",
        ),
        # Branch scopes union rather than intersect, so the widest wins: a row
        # from the orphan-aware branch need not satisfy the strict one.
        pytest.param(
            "(parent_id is None and a == 1) or (parent_span is None and b == 2)",
            "orphan_aware",
            id="all-branches-widest-wins",
        ),
        # One unscoped branch admits non-root rows, so the whole is unscoped.
        pytest.param(
            "(parent_id is None and a == 1) or b == 2",
            None,
            id="one-branch-unscoped",
        ),
        # `not (x is not None)` is the double negative of a root predicate.
        pytest.param("not (parent_id is not None)", "strict", id="negated-is-not-none"),
        pytest.param("not (parent_span is not None)", "orphan_aware", id="negated-orphan-aware"),
        # Negating a root predicate selects non-root spans, the opposite.
        pytest.param("not (parent_id is None)", None, id="negated-root-predicate"),
    ],
)
def test_root_span_scope_handles_disjunctions_and_negations(
    condition: str,
    expected: typing.Optional[RootSpanScope],
) -> None:
    assert root_span_scope(condition) == expected


# `root_span_scope` has two consumers with two different failure modes, so it
# owes two separate guarantees.
#
# SOUNDNESS, covered here: a non-None answer must be true. The query builders
# drop the `root_spans_only` flag's SQL on the strength of it, so an over-claim
# readmits the rows that flag would have excluded -- the only failure mode that
# changes a result set.
#
# COMPLETENESS, covered by the scope tests above: supported root-only forms must
# return a scope. This is *not* merely an optimization concern.
# `analyzeSpanFilterCondition` surfaces the same answer to the frontend, which
# reads None as "not root-scoped" and picks per-span rather than cumulative
# metric columns. So under-claiming cannot change which rows come back, but it
# is user-visible, and unsupported forms are a known gap rather than a
# non-issue.
#
# Below: conditions that admit at least one non-root span, all of which must
# return None.
_CONDITIONS_ADMITTING_NON_ROOT_SPANS = [
    "span_kind == 'LLM'",
    "parent_id is not None",
    "parent_span is not None",
    "not (parent_id is None)",
    "not (parent_span is None)",
    # compared to something other than None
    "parent_id == 'abc'",
    "parent_id != None",
    "'x' in parent_id",
    # an *attribute* that happens to be named parent_id is a different thing
    "attributes['parent_id'] is None",
    # one unscoped branch is enough to admit non-root rows
    "parent_id is None or span_kind == 'LLM'",
    "parent_id is None or True",
    "(parent_id is None and span_kind == 'CHAIN') or span_kind == 'LLM'",
    "parent_span is None or parent_id is not None",
    # a tautology matches everything, root or not
    "parent_id is None or parent_id is not None",
    # De Morgan: `parent_id is not None or span_kind != 'LLM'`, which admits
    # any span whose kind is not LLM, root or not.
    "not (parent_id is None and span_kind == 'LLM')",
]


@pytest.mark.parametrize("condition", _CONDITIONS_ADMITTING_NON_ROOT_SPANS)
def test_root_span_scope_never_over_claims_on_non_root_conditions(condition: str) -> None:
    assert root_span_scope(condition) is None


# Conditions restricting to orphan-aware roots but *not* to strict roots: they
# match spans whose parent_id is set but absent from the table. Reporting
# "strict" for any of these would let a caller drop a strict `root_spans_only`
# flag, readmitting the orphans that flag exists to exclude.
_ORPHAN_AWARE_BUT_NOT_STRICT_CONDITIONS = [
    "parent_span is None",
    "parent_span == None",
    "None is parent_span",
    "parent_span is None and span_kind == 'CHAIN'",
    "(parent_span is None and span_kind == 'CHAIN') or (parent_span is None and latency_ms > 5)",
    "not (parent_span is not None)",
]


@pytest.mark.parametrize("condition", _ORPHAN_AWARE_BUT_NOT_STRICT_CONDITIONS)
def test_root_span_scope_never_over_claims_strictness(condition: str) -> None:
    assert root_span_scope(condition) != "strict"


@pytest.mark.parametrize(
    "condition,expected",
    [
        # Double negation is the identity on which rows come back.
        pytest.param("not not (parent_id is None)", "strict", id="double-negation"),
        pytest.param("not not (parent_span is None)", "orphan_aware", id="double-negation-orphan"),
        # A chained comparison is a conjunction of its links.
        pytest.param("None is parent_id is None", "strict", id="chained-comparison"),
        pytest.param("None is parent_span is None", "orphan_aware", id="chained-comparison-orphan"),
        # ...so an unscoped link drops out rather than disqualifying the chain.
        pytest.param(
            "span_kind == 'CHAIN' and None is parent_id is None",
            "strict",
            id="chained-comparison-in-conjunction",
        ),
    ],
)
def test_root_span_scope_classifies_equivalent_rewrites(
    condition: str,
    expected: typing.Optional[RootSpanScope],
) -> None:
    """Forms that mean the same thing as a plain root predicate must classify the
    same way, since the frontend picks metric columns off this answer."""
    assert root_span_scope(condition) == expected


@pytest.mark.parametrize(
    "condition,expected",
    [
        # `not (A or B)` is `not A and not B`: one restricting conjunct bounds
        # the whole, so an unrestricting sibling drops out.
        pytest.param(
            "not (parent_id is not None or span_kind == 'LLM')",
            "strict",
            id="not-or-strict",
        ),
        pytest.param(
            "not (parent_span is not None or span_kind == 'LLM')",
            "orphan_aware",
            id="not-or-orphan-aware",
        ),
        # `not (A and B)` is `not A or not B`: a disjunction, so *every* negated
        # branch has to restrict.
        pytest.param(
            "not (parent_id is not None and parent_span is not None)",
            "orphan_aware",
            id="not-and-both-negated-branches-restrict",
        ),
        pytest.param(
            "not (parent_id is not None and span_kind == 'LLM')",
            None,
            id="not-and-one-branch-unrestricting",
        ),
        # Nested polarity: two negations restore the original sense.
        pytest.param(
            "not (not (parent_id is None) and span_kind == 'LLM')",
            None,
            id="nested-negation-disjunction",
        ),
        pytest.param(
            "not (not (parent_id is None) or span_kind == 'LLM')",
            "strict",
            id="nested-negation-conjunction",
        ),
        # A literal-True conjunct negates to a literal-False branch, which
        # contributes no rows and folds out of the disjunction.
        pytest.param(
            "not (parent_id is not None and True)",
            "strict",
            id="not-and-true-folds",
        ),
        # ...whereas negating a literal-False conjunct yields a branch matching
        # everything, so nothing is restricted.
        pytest.param(
            "not (parent_id is not None and False)",
            None,
            id="not-and-false-does-not-fold",
        ),
    ],
)
def test_root_span_scope_applies_de_morgan(
    condition: str,
    expected: typing.Optional[RootSpanScope],
) -> None:
    """Negation is handled by flipping polarity during the descent, so `and` and
    `or` swap roles under a `not`. These pin both directions, including the ones
    that must stay unrestricted -- a swapped rule would over-claim there."""
    assert root_span_scope(condition) == expected


@pytest.mark.parametrize(
    "condition,expected",
    [
        # A literal that can never be TRUE returns nothing, and an empty result
        # is vacuously root-scoped -- so such a branch cannot widen a disjunction
        # and drops out of one on its own.
        pytest.param("parent_id is None or False", "strict", id="or-false"),
        pytest.param("parent_id is None or None", "strict", id="or-null"),
        pytest.param("parent_id is None or not True", "strict", id="or-not-true"),
        pytest.param("not (parent_id is not None and None)", "strict", id="not-and-null"),
        pytest.param(
            "parent_span is None or (False and span_kind == 'LLM')",
            "orphan_aware",
            id="or-never-true-conjunction",
        ),
        # `None` is never TRUE in either sense -- `not NULL` is NULL, still not
        # TRUE -- whereas `not False` is always TRUE and restricts nothing.
        pytest.param("parent_id is None or not None", "strict", id="or-not-null"),
        pytest.param("parent_id is None or not False", None, id="or-not-false"),
        pytest.param("parent_id is None or True", None, id="or-true"),
        # A never-TRUE conjunct empties the whole conjunction, which is
        # vacuously root-scoped.
        pytest.param("span_kind == 'LLM' and False", "strict", id="and-false"),
        # ...but as a disjunct it leaves the other branch's rows, which are not
        # root-scoped.
        pytest.param("span_kind == 'LLM' or False", None, id="or-false-unscoped-sibling"),
    ],
)
def test_root_span_scope_treats_never_true_literals_as_vacuously_scoped(
    condition: str,
    expected: typing.Optional[RootSpanScope],
) -> None:
    """Constant folding is not special-cased: mapping a never-TRUE leaf to the
    narrowest scope makes it fall out of the same lattice rules as everything
    else."""
    assert root_span_scope(condition) == expected


@pytest.mark.parametrize(
    "condition",
    [
        pytest.param("not " * 2000 + "(parent_id is None)", id="deep-negation"),
        pytest.param("(" * 2000 + "parent_id is None" + ")" * 2000, id="deep-grouping"),
        pytest.param(" or ".join(["parent_id is None"] * 2000), id="wide-disjunction"),
    ],
)
def test_root_span_scope_survives_pathologically_nested_input(condition: str) -> None:
    """The analyzer is reachable from the API with an arbitrary string, so input
    deep enough to exhaust the stack has to read as "cannot tell" rather than
    escaping as a RecursionError."""
    assert root_span_scope(condition) in (None, "strict")


# Atoms for the generated corpus below. The root predicates appear in both
# spellings and both polarities; the ordinary predicates discriminate among the
# fixture's spans without saying anything about parentage; the constants exist
# to exercise the never-TRUE folding.
_CORPUS_ATOMS = (
    "parent_id is None",
    "parent_id is not None",
    "parent_span is None",
    "parent_span is not None",
    "span_kind == 'LLM'",
    "name == 'A'",
    "name == 'C'",
    "status_code == 'OK'",
    "True",
    "False",
    "None",
)


def _generate_expression(rand: random.Random, depth: int) -> str:
    if depth <= 0:
        return rand.choice(_CORPUS_ATOMS)
    kind = rand.choice(("atom", "atom", "and", "or", "not"))
    if kind == "atom":
        return rand.choice(_CORPUS_ATOMS)
    if kind == "not":
        return f"not ({_generate_expression(rand, depth - 1)})"
    joiner = " and " if kind == "and" else " or "
    operands = [_generate_expression(rand, depth - 1) for _ in range(rand.randint(2, 3))]
    return "(" + joiner.join(operands) + ")"


async def test_root_span_scope_never_over_claims_against_generated_expressions(
    db: DbSessionFactory,
    parent_predicate_project: None,
) -> None:
    """Checks soundness against the database rather than against expectations.

    Every other test here asserts a hand-authored answer, which only ever
    confirms the cases someone thought of. This one generates boolean
    expressions, and wherever the analyzer commits to a scope it runs the
    condition as SQL and requires that every row actually returned satisfies
    that scope. So the analyzer is checked against the translator and the
    database's own three-valued logic, not against a second model of them.

    Only over-claiming is a failure. A ``None`` verdict is allowed for anything,
    since under-claiming is the safe direction.
    """
    rand = random.Random(14497)
    # `A` is the only strict root; `C` is an orphan, a root only in the wider
    # sense; `B` and `D` have parents present in the table.
    allowed_by_scope = {"strict": {"A"}, "orphan_aware": {"A", "C"}}

    exercised: Counter[str] = Counter()
    async with db() as session:
        for _ in range(400):
            condition = _generate_expression(rand, depth=3)
            scope = root_span_scope(condition)
            if scope is None:
                continue
            try:
                span_filter = SpanFilter(condition)
            except SyntaxError:
                # e.g. a bare constant, which the DSL rejects as a whole condition
                continue
            returned = set(await session.scalars(span_filter(select(models.Span.span_id))))
            assert returned <= allowed_by_scope[scope], (
                f"{condition!r} was reported as {scope!r} but returned {sorted(returned)}"
            )
            exercised[scope] += 1
            if "not " in condition:
                exercised["negated"] += 1
            if any(literal in condition for literal in ("True", "False", "None")):
                exercised["with_literal"] += 1
            if returned:
                # The assertion above is vacuously satisfied by an empty result,
                # so at least some verdicts have to be checked against rows that
                # were actually returned.
                exercised["returned_rows"] += 1

    # Without this the assertions above could pass on a corpus that had
    # degenerated -- into expressions that never commit to a scope, that only
    # ever reach one verdict, or that all match nothing.
    minimums = {
        "strict": 5,
        "orphan_aware": 3,
        "negated": 3,
        "with_literal": 3,
        "returned_rows": 5,
    }
    missing = {k: (exercised[k], n) for k, n in minimums.items() if exercised[k] < n}
    assert not missing, f"corpus under-exercised (got, wanted): {missing}; all: {dict(exercised)}"


@pytest.mark.parametrize(
    "condition,expected_message",
    [
        pytest.param(
            "not " * 500 + "(parent_id is None)",
            "nested too deeply",
            id="deep-negation",
        ),
        # CPython's parser rejects deeply nested grouping on its own, before any
        # stack is exhausted, so this arrives as a SyntaxError already. Its
        # wording belongs to the interpreter and varies by version, so only the
        # type is asserted -- the invariant is the same either way.
        pytest.param(
            "(" * 500 + "parent_id is None" + ")" * 500,
            None,
            id="deep-grouping",
        ),
    ],
)
def test_span_filter_reports_deeply_nested_input_as_malformed(
    condition: str,
    expected_message: typing.Optional[str],
) -> None:
    """Every stage of construction recurses -- the parser, the validator, the
    translator, `compile` -- and conditions arrive from the API, so input deep
    enough to exhaust the stack has to surface as a malformed filter rather than
    as a RecursionError escaping from whichever stage ran out first."""
    with pytest.raises(SyntaxError, match=expected_message):
        SpanFilter(condition)
