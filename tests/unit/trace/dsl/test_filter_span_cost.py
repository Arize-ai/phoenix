"""Tests for span-cost expressions in the span filter DSL."""

import re
from datetime import datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import Select, func, insert, select

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.filter import SpanFilter, SpanFilterError

_TS = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")

# span_id -> (total_cost, prompt_cost, completion_cost, total_tokens)
_PRICED = {
    "priced": (1.0, 0.75, 0.25, 100.0),
    "cheap": (0.1, 0.06, 0.04, 1000.0),
    "untokenized": (0.5, 0.5, 0.0, 0.0),
}
_UNCOSTED = "uncosted"

_RATIO = "sum(d.cost for d in cost_details) / sum(d.tokens for d in cost_details)"

# span_id -> [(token_type, is_prompt, cost, tokens, cost_per_token)]
_DETAILS: dict[str, list[tuple[str, bool, float, float, float | None]]] = {
    "priced": [("input", True, 0.75, 75.0, 0.01), ("output", False, 0.25, 25.0, 0.01)],
    "cheap": [("input", True, 0.06, 600.0, 0.0001), ("cache_read", True, 0.04, 400.0, 0.0001)],
    "untokenized": [("input", True, 0.5, 0.0, None)],
}


@pytest.fixture
async def cost_project(db: DbSessionFactory) -> None:
    async with db() as session:
        project_rowid = await session.scalar(
            insert(models.Project).values(name="cost").returning(models.Project.id)
        )
        trace_rowid = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace-cost",
                project_rowid=project_rowid,
                start_time=_TS,
                end_time=_TS + timedelta(seconds=60),
            )
            .returning(models.Trace.id)
        )
        for span_id in (*_PRICED, _UNCOSTED):
            span_rowid = await session.scalar(
                insert(models.Span)
                .values(
                    trace_rowid=trace_rowid,
                    span_id=span_id,
                    parent_id=None,
                    name=span_id,
                    span_kind="LLM",
                    start_time=_TS,
                    end_time=_TS + timedelta(seconds=1),
                    attributes={},
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
                .returning(models.Span.id)
            )
            if span_id not in _PRICED:
                continue
            total_cost, prompt_cost, completion_cost, total_tokens = _PRICED[span_id]
            span_cost_id = await session.scalar(
                insert(models.SpanCost)
                .values(
                    span_rowid=span_rowid,
                    trace_rowid=trace_rowid,
                    span_start_time=_TS,
                    total_cost=total_cost,
                    prompt_cost=prompt_cost,
                    completion_cost=completion_cost,
                    total_tokens=total_tokens,
                    prompt_tokens=total_tokens,
                    completion_tokens=0.0,
                )
                .returning(models.SpanCost.id)
            )
            for token_type, is_prompt, cost, tokens, per_token in _DETAILS[span_id]:
                await session.execute(
                    insert(models.SpanCostDetail).values(
                        span_cost_id=span_cost_id,
                        token_type=token_type,
                        is_prompt=is_prompt,
                        cost=cost,
                        tokens=tokens,
                        cost_per_token=per_token,
                    )
                )


async def _matching(db: DbSessionFactory, condition: str) -> list[str]:
    span_filter = SpanFilter(condition)
    async with db() as session:
        rows = await session.scalars(span_filter(select(models.Span.span_id).join(models.Trace)))
        return sorted(rows.all())


@pytest.mark.parametrize(
    "condition,expected",
    [
        pytest.param("total_cost > 0.5", ["priced"], id="total-cost"),
        pytest.param("total_cost >= 0.5", ["priced", "untokenized"], id="inclusive"),
        pytest.param("prompt_cost > 0.5", ["priced"], id="prompt-cost"),
        pytest.param("completion_cost > 0", ["cheap", "priced"], id="completion-cost"),
        pytest.param("0.05 < total_cost", ["cheap", "priced", "untokenized"], id="on-right"),
        pytest.param("total_cost > 0.05 and name == 'cheap'", ["cheap"], id="with-span-column"),
        # Exercises two cost bindings and missing-row coalescing in one expression.
        pytest.param("prompt_cost + completion_cost > 0.5", ["priced"], id="sum"),
        # Cost arithmetic against a cost scalar; the absent row matches via 0 + 0 == 0.
        pytest.param(
            "prompt_cost + completion_cost == total_cost",
            ["cheap", "priced", "uncosted", "untokenized"],
            id="sum-vs-scalar",
        ),
    ],
)
async def test_cost_members_filter_rows(
    db: DbSessionFactory,
    cost_project: None,
    condition: str,
    expected: list[str],
) -> None:
    assert await _matching(db, condition) == expected


@pytest.mark.parametrize(
    "condition,expected",
    [
        # Missing cost rows coalesce to zero.
        pytest.param("total_cost == 0", [_UNCOSTED], id="absent-reads-as-zero"),
        pytest.param("total_cost >= 0", ["cheap", "priced", "uncosted", "untokenized"], id="all"),
        pytest.param("not (total_cost > 0.05)", [_UNCOSTED], id="negation-includes-absent"),
    ],
)
async def test_absent_cost_row_coalesces_to_zero(
    db: DbSessionFactory,
    cost_project: None,
    condition: str,
    expected: list[str],
) -> None:
    assert await _matching(db, condition) == expected


@pytest.mark.parametrize(
    "condition,expected",
    [
        pytest.param(f"{_RATIO} > 0.005", ["priced"], id="ratio-threshold"),
        # Missing and zero token totals produce a null rate through `nullif`.
        pytest.param(
            f"{_RATIO} is None",
            ["uncosted", "untokenized"],
            id="ratio-is-null",
        ),
        pytest.param(f"not ({_RATIO} > 0.005)", ["cheap"], id="ratio-negation-drops-null"),
    ],
)
async def test_cost_per_token_is_expressible_as_division(
    db: DbSessionFactory,
    cost_project: None,
    condition: str,
    expected: list[str],
) -> None:
    assert await _matching(db, condition) == expected


@pytest.mark.parametrize(
    "condition,joined",
    [
        pytest.param("total_cost > 1", True, id="referenced"),
        pytest.param("latency_ms > 5", False, id="not-referenced"),
        pytest.param("attributes['span'] == 'x'", False, id="attribute-named-span"),
    ],
)
def test_span_cost_is_joined_only_when_referenced(condition: str, joined: bool) -> None:
    stmt = SpanFilter(condition)(select(models.Span.id).join(models.Trace))
    assert ("span_costs" in str(stmt.compile())) is joined


def test_cost_scalar_arithmetic_stays_numeric() -> None:
    # A `String` cast here errors on PostgreSQL and compares text on SQLite.
    stmt = SpanFilter("prompt_cost + completion_cost == total_cost")(
        select(models.Span.id).join(models.Trace)
    )
    sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    assert "CAST" not in sql, sql


async def test_span_cost_join_does_not_collide_with_a_caller_join(
    db: DbSessionFactory,
    cost_project: None,
) -> None:
    stmt = (
        select(func.sum(models.SpanCost.total_cost))
        .select_from(models.Trace)
        .join(models.SpanCost, models.Trace.id == models.SpanCost.trace_rowid)
        .join_from(models.SpanCost, models.Span)
    )
    stmt = SpanFilter("total_cost > 0.05")(stmt)
    async with db() as session:
        # `cheap` + `priced` + `untokenized`, i.e. every span above the threshold.
        assert await session.scalar(stmt) == pytest.approx(1.6)


@pytest.mark.parametrize(
    "condition,expected",
    [
        pytest.param(
            'any(d.token_type == "cache_read" for d in cost_details)',
            ["cheap"],
            id="any",
        ),
        pytest.param(
            'sum(d.tokens for d in cost_details if d.token_type == "input") > 100',
            ["cheap"],
            id="sum-with-condition",
        ),
        pytest.param("max(d.cost for d in cost_details) > 0.5", ["priced"], id="max"),
        pytest.param("len([d for d in cost_details]) == 2", ["cheap", "priced"], id="len"),
        pytest.param(
            'any(d.cost > 0.5 for d in cost_details) and name == "priced"',
            ["priced"],
            id="composed-with-span-column",
        ),
        pytest.param(
            "any(d.cost > 0.05 for d in cost_details) and total_cost > 0.4",
            ["priced", "untokenized"],
            id="composed-with-a-scalar-member",
        ),
        # The loop variable may shadow an outer name.
        pytest.param(
            'any(span.token_type == "cache_read" for span in cost_details)',
            ["cheap"],
            id="loop-variable-shadows-the-root",
        ),
    ],
)
async def test_cost_details_comprehensions_filter_rows(
    db: DbSessionFactory,
    cost_project: None,
    condition: str,
    expected: list[str],
) -> None:
    assert await _matching(db, condition) == expected


@pytest.mark.parametrize(
    "condition,expected",
    [
        # CPython is the reference: `all(())` is True, so a span with no detail rows
        # satisfies every `all(...)`, and `len(())` / `sum(())` are 0 rather than NULL.
        pytest.param(
            "all(d.is_prompt for d in cost_details)",
            ["cheap", "uncosted", "untokenized"],
            id="all-over-empty-is-true",
        ),
        pytest.param("len([d for d in cost_details]) == 0", [_UNCOSTED], id="len-of-empty"),
        pytest.param("sum(d.cost for d in cost_details) == 0", [_UNCOSTED], id="sum-of-empty"),
        # `max(())` raises in Python; in SQL it is NULL, which reads as missing and fails
        # every comparison in both directions.
        pytest.param(
            "not (max(d.cost for d in cost_details) > 0.5)",
            ["cheap", "untokenized"],
            id="max-of-empty-is-null",
        ),
        # An element field stays nullable, so a NULL `cost_per_token` row is no
        # counterexample to a `>` test but is also not a match.
        pytest.param(
            "any(d.cost_per_token > 0.005 for d in cost_details)",
            ["priced"],
            id="null-element",
        ),
    ],
)
async def test_cost_details_empty_and_null_semantics(
    db: DbSessionFactory,
    cost_project: None,
    condition: str,
    expected: list[str],
) -> None:
    assert await _matching(db, condition) == expected


def _caller_statement_joining_span_costs() -> Select[Any]:
    """`span_cost_summary_by_project`'s shape: `span_costs` already joined, unaliased."""
    return (
        select(func.count())
        .select_from(models.Trace)
        .join(models.SpanCost, models.Trace.id == models.SpanCost.trace_rowid)
        .join_from(models.SpanCost, models.Span)
    )


async def test_cost_details_subquery_reads_only_this_span(
    db: DbSessionFactory,
    cost_project: None,
) -> None:
    stmt = SpanFilter('any(d.token_type == "cache_read" for d in cost_details)')(
        _caller_statement_joining_span_costs()
    )
    async with db() as session:
        # Only `cheap` has a cache_read row.
        assert await session.scalar(stmt) == 1


def test_cost_details_subquery_aliases_its_own_join() -> None:
    stmt = SpanFilter('any(d.token_type == "cache_read" for d in cost_details)')(
        _caller_statement_joining_span_costs()
    )
    sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    subquery = sql[sql.index("EXISTS") :]
    assert re.search(r"JOIN span_costs AS span_costs_\d+", subquery), subquery


@pytest.fixture
async def mixed_null_detail(db: DbSessionFactory) -> None:
    """Create a span with both null and non-null per-token costs."""
    async with db() as session:
        project_rowid = await session.scalar(
            insert(models.Project).values(name="mixed").returning(models.Project.id)
        )
        trace_rowid = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace-mixed",
                project_rowid=project_rowid,
                start_time=_TS,
                end_time=_TS + timedelta(seconds=60),
            )
            .returning(models.Trace.id)
        )
        span_rowid = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_rowid,
                span_id="mixed",
                parent_id=None,
                name="mixed",
                span_kind="LLM",
                start_time=_TS,
                end_time=_TS + timedelta(seconds=1),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )
        span_cost_id = await session.scalar(
            insert(models.SpanCost)
            .values(
                span_rowid=span_rowid,
                trace_rowid=trace_rowid,
                span_start_time=_TS,
                total_cost=1.0,
                total_tokens=100.0,
            )
            .returning(models.SpanCost.id)
        )
        for token_type, per_token in (("input", 0.01), ("output", None)):
            await session.execute(
                insert(models.SpanCostDetail).values(
                    span_cost_id=span_cost_id,
                    token_type=token_type,
                    is_prompt=token_type == "input",
                    cost=0.5,
                    tokens=50.0,
                    cost_per_token=per_token,
                )
            )


@pytest.mark.parametrize(
    "condition,expected",
    [
        # Quantifiers count null predicates as counterexamples; SQL reductions skip them.
        pytest.param(
            "all(d.cost_per_token > 0.005 for d in cost_details)",
            [],
            id="all-counts-a-null-element-as-a-counterexample",
        ),
        pytest.param(
            "min(d.cost_per_token for d in cost_details) > 0.005",
            ["mixed"],
            id="min-skips-a-null-element",
        ),
        pytest.param(
            "sum(d.cost_per_token for d in cost_details) > 0.005",
            ["mixed"],
            id="sum-skips-a-null-element",
        ),
    ],
)
async def test_reductions_skip_null_elements_where_quantifiers_do_not(
    db: DbSessionFactory,
    mixed_null_detail: None,
    condition: str,
    expected: list[str],
) -> None:
    assert await _matching(db, condition) == expected


# span_id -> annotation score
_SCORES = {"priced": 1.0, "cheap": 1.0, "untokenized": 0.0}


@pytest.fixture
async def annotated_cost_project(db: DbSessionFactory, cost_project: None) -> None:
    async with db() as session:
        result = await session.execute(select(models.Span.span_id, models.Span.id))
        rowids: dict[str, int] = dict(result.tuples().all())
        for span_id, score in _SCORES.items():
            await session.execute(
                insert(models.SpanAnnotation).values(
                    span_rowid=rowids[span_id],
                    name="q",
                    label="ok",
                    score=score,
                    explanation="",
                    metadata_={},
                    annotator_kind="HUMAN",
                    identifier="",
                    source="APP",
                )
            )


@pytest.mark.parametrize(
    "condition,expected",
    [
        pytest.param(
            "annotations['q'].score > 0.5 and total_cost > 0.5",
            ["priced"],
            id="scalar-reads-this-spans-cost",
        ),
        pytest.param(
            "annotations['q'].score > 0.5 and any(d.token_type == 'cache_read' for d in cost_details)",
            ["cheap"],
            id="comprehension-reads-this-spans-details",
        ),
        pytest.param(
            "annotations['q'].score > 0.5 and total_cost > 0.5 "
            "and any(d.token_type == 'input' for d in cost_details)",
            ["priced"],
            id="scalar-and-comprehension-together",
        ),
    ],
)
async def test_cost_and_annotation_in_one_condition_read_the_same_span(
    db: DbSessionFactory,
    annotated_cost_project: None,
    condition: str,
    expected: list[str],
) -> None:
    assert await _matching(db, condition) == expected


@pytest.mark.parametrize(
    "condition,message",
    [
        pytest.param("total_cost > '1'", "cannot compare", id="string-comparand"),
        pytest.param("cost_details > 1", "can only be iterated", id="collection-in-value-position"),
        # A reduction is a number, not a predicate, so it cannot stand alone as
        # the whole condition any more than in `and` / `or` position.
        pytest.param(
            "sum(d.cost for d in cost_details)",
            "is not a condition",
            id="bare-reduction-as-condition",
        ),
        pytest.param(
            "len([d for d in cost_details])",
            "is not a condition",
            id="bare-len-as-condition",
        ),
    ],
)
def test_cost_name_rejections(condition: str, message: str) -> None:
    with pytest.raises(SpanFilterError, match=message):
        SpanFilter(condition)


@pytest.mark.parametrize(
    "condition",
    [
        pytest.param("totl_cost > 1", id="typo"),
        pytest.param("span.total_cost > 1", id="dotted-spelling"),
        pytest.param("span == 'x'", id="bare-span"),
    ],
)
def test_a_cost_typo_falls_back_to_an_attribute_path(condition: str) -> None:
    assert SpanFilter(condition).condition == condition


@pytest.mark.parametrize(
    "name",
    ["total_cost", "prompt_cost", "completion_cost", "cost_details"],
)
def test_cost_names_no_longer_read_the_attribute_of_the_same_name(name: str) -> None:
    from ast import unparse

    from phoenix.trace.dsl.filter import SPAN_BINDINGS

    assert name in SPAN_BINDINGS.binding_names or name in SPAN_BINDINGS.iterables
    if name != "cost_details":
        rendered = unparse(SpanFilter(f"{name} > 1").translated)
        assert f"attributes[['{name}']]" not in rendered


@pytest.mark.parametrize("name", ["total_tokens", "prompt_tokens", "completion_tokens"])
def test_token_names_are_not_claimed(name: str) -> None:
    from ast import unparse

    from phoenix.trace.dsl.filter import SPAN_BINDINGS

    assert name not in SPAN_BINDINGS.binding_names
    assert name not in SPAN_BINDINGS.iterables
    assert f"attributes[['{name}']]" in unparse(SpanFilter(f"{name} > 1").translated)


def test_projection_does_not_resolve_cost_names() -> None:
    from ast import unparse

    from phoenix.trace.dsl.filter import Projector

    rendered = unparse(Projector("total_cost").translated)
    assert "attributes[['total_cost']]" in rendered


def test_cost_members_have_one_declared_type_on_both_sides() -> None:
    from phoenix.trace.dsl.filter import _SPAN_COST_SCALARS, _get_named_filter_value_type

    for member in _SPAN_COST_SCALARS:
        assert _get_named_filter_value_type(member) == "number"
    assert _get_named_filter_value_type("nope") is None
