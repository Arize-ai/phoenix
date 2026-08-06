"""The `span.` reserved root: this span's own cost row, read through a closed member set.

Cost lives on `span_costs`, not on `spans`, so these members are not columns of the
filtered row -- they are bound against an outer join the filter adds for itself. That makes
three things worth testing beyond "the comparison works": that the join appears only when a
member is referenced, that it does not collide with a join the caller already made, and
that a span with no cost row answers the way the family says a missing value should.
"""

from datetime import datetime, timedelta

import pytest
from sqlalchemy import func, insert, select

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.filter import SpanFilter, SpanFilterError

_TS = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")

# span_id -> (total_cost, prompt_cost, completion_cost, total_tokens)
#
# `uncosted` has no `span_costs` row at all, which is the common case for any span that is
# not an LLM call. `untokenized` has a cost but zero tokens, which is the only way to reach
# a recorded cost row whose *ratio* is still undefined -- the two rows exist to keep those
# cases apart, because coalescing treats them identically and the ratios must not.
_PRICED = {
    "priced": (1.0, 0.75, 0.25, 100.0),
    "cheap": (0.1, 0.06, 0.04, 1000.0),
    "untokenized": (0.5, 0.5, 0.0, 0.0),
}
_UNCOSTED = "uncosted"


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
            await session.execute(
                insert(models.SpanCost).values(
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
            )


async def _matching(db: DbSessionFactory, condition: str) -> list[str]:
    span_filter = SpanFilter(condition)
    async with db() as session:
        rows = await session.scalars(span_filter(select(models.Span.span_id).join(models.Trace)))
        return sorted(rows.all())


@pytest.mark.parametrize(
    "condition,expected",
    [
        pytest.param("span.total_cost > 0.5", ["priced"], id="total-cost"),
        pytest.param("span.total_cost >= 0.5", ["priced", "untokenized"], id="inclusive"),
        pytest.param("span.prompt_cost > 0.5", ["priced"], id="prompt-cost"),
        pytest.param("span.completion_cost > 0", ["cheap", "priced"], id="completion-cost"),
        pytest.param("span.total_tokens > 500", ["cheap"], id="total-tokens"),
        pytest.param("0.05 < span.total_cost", ["cheap", "priced", "untokenized"], id="on-right"),
        pytest.param(
            "span.total_cost > 0.05 and name == 'cheap'", ["cheap"], id="with-span-column"
        ),
        # Arithmetic across two members, so both resolve in one expression. `untokenized`
        # sums to exactly 0.5 and is excluded, which also pins that the operands are the
        # coalesced columns rather than raw NULLs (a NULL addend would drop `uncosted`
        # from a `>= 0` test too -- see the coalescing cases below).
        pytest.param("span.prompt_cost + span.completion_cost > 0.5", ["priced"], id="sum"),
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
        # An absent cost row reads as 0, matching the session grain's rollups ("0 when no
        # cost is configured, never null") so one name means one thing across grains.
        pytest.param("span.total_cost == 0", [_UNCOSTED], id="absent-reads-as-zero"),
        pytest.param(
            "span.total_cost >= 0", ["cheap", "priced", "uncosted", "untokenized"], id="all"
        ),
        # Which also means an uncosted span is excluded by a positive threshold *and* by
        # its negation -- there is no NULL here to make both false.
        pytest.param("not (span.total_cost > 0.05)", [_UNCOSTED], id="negation-includes-absent"),
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
        pytest.param("span.total_cost_per_token > 0.005", ["priced"], id="ratio-threshold"),
        # NULL for both reasons a ratio can be undefined: no cost row, and a cost row whose
        # token count is zero. Coalescing these to 0 would assert a rate nobody recorded.
        pytest.param(
            "span.total_cost_per_token is None", ["uncosted", "untokenized"], id="ratio-is-null"
        ),
        # And a NULL ratio fails the comparison in both directions, which is the family's
        # legislated rule for a missing value.
        pytest.param(
            "not (span.total_cost_per_token > 0.005)", ["cheap"], id="ratio-negation-drops-null"
        ),
    ],
)
async def test_cost_per_token_ratios_stay_null(
    db: DbSessionFactory,
    cost_project: None,
    condition: str,
    expected: list[str],
) -> None:
    assert await _matching(db, condition) == expected


@pytest.mark.parametrize(
    "condition,joined",
    [
        pytest.param("span.total_cost > 1", True, id="referenced"),
        pytest.param("latency_ms > 5", False, id="not-referenced"),
        pytest.param("attributes['span'] == 'x'", False, id="attribute-named-span"),
    ],
)
def test_span_cost_is_joined_only_when_referenced(condition: str, joined: bool) -> None:
    """The namespace costs nothing to the conditions that do not use it.

    Span filters run on every trace and span view; adding an unconditional outer join for a
    vocabulary most conditions never mention would tax all of them.
    """
    stmt = SpanFilter(condition)(select(models.Span.id).join(models.Trace))
    assert ("span_costs" in str(stmt.compile())) is joined


async def test_span_cost_join_does_not_collide_with_a_caller_join(
    db: DbSessionFactory,
    cost_project: None,
) -> None:
    """The filter's join is aliased because callers already join `span_costs` themselves.

    `span_cost_summary_by_project` builds exactly this shape -- aggregate over `SpanCost`,
    then apply the span filter to it. An unaliased join in the filter would collide with
    the caller's, and the failure would land in a dataloader rather than in the DSL.
    """
    stmt = (
        select(func.sum(models.SpanCost.total_cost))
        .select_from(models.Trace)
        .join(models.SpanCost, models.Trace.id == models.SpanCost.trace_rowid)
        .join_from(models.SpanCost, models.Span)
    )
    stmt = SpanFilter("span.total_cost > 0.05")(stmt)
    async with db() as session:
        # `cheap` + `priced` + `untokenized`, i.e. every span above the threshold.
        assert await session.scalar(stmt) == pytest.approx(1.6)


@pytest.mark.parametrize(
    "condition,message",
    [
        pytest.param("span.totl_cost > 1", "did you mean `span.total_cost`", id="typo"),
        pytest.param("span.k > 1", "invalid field `span.k`", id="unknown-member"),
        pytest.param("span.total_cost.x > 1", "cannot be traversed further", id="multi-hop"),
        pytest.param("span['total_cost'] > 1", "cannot be traversed further", id="subscript"),
        pytest.param("span is None", "can only be used as `span.<field>`", id="bare-root"),
        pytest.param("span.total_cost > '1'", "cannot compare", id="string-comparand"),
    ],
)
def test_reserved_root_rejections(condition: str, message: str) -> None:
    """Closing the member set is what makes these answerable.

    Every one of these would previously have compiled to an `attributes['span...']` read
    that matched nothing and said nothing. Reserving the root is a compatibility break for
    conditions that genuinely keyed such an attribute -- taken deliberately, and loudly.
    """
    with pytest.raises(SpanFilterError, match=message):
        SpanFilter(condition)


@pytest.mark.parametrize(
    "condition",
    [
        pytest.param("total_cost > 1", id="bare-name-is-still-an-attribute"),
        pytest.param("attributes['span'] == 'x'", id="attributes-keyed-span"),
        pytest.param("attributes['span']['total_cost'] > 1", id="attributes-keyed-span-path"),
    ],
)
def test_reserved_root_shadows_only_the_dotted_spelling(condition: str) -> None:
    """No previously-bare name changed meaning.

    The cost members are reachable only through the root, so `total_cost` is the attribute
    path it always was, and naming the `span` attribute explicitly still works. Only the
    dotted `span.<x>` spelling was taken.
    """
    assert SpanFilter(condition).condition == condition


def test_projection_does_not_resolve_the_reserved_root() -> None:
    """Reserved roots are a filter-language feature; `Projector` is unchanged.

    Documented rather than fixed, because the alternative is worse: `parent_span.<field>`
    has the same shape in projections today, and diverging the two roots would be a new
    inconsistency. Pinned so the choice is visible if projections ever grow the namespace.
    """
    from ast import unparse

    from phoenix.trace.dsl.filter import Projector

    rendered = unparse(Projector("span.total_cost").translated)
    assert "attributes[['span', 'total_cost']]" in rendered


def test_cost_members_have_one_declared_type_on_both_sides() -> None:
    """Validation types the dotted spelling; translation rewrites it. They must agree.

    Validation runs ahead of translation and so never sees the internal name, which is how
    two encodings of one rule drift apart. Reading both off the one namespace declaration
    is what prevents `span.total_cost > '100'` from validating while `latency_ms > '100'`
    rejects.
    """
    from phoenix.trace.dsl.filter import _SPAN_NAMESPACE, _get_named_filter_value_type

    for member in _SPAN_NAMESPACE.scalars:
        assert _get_named_filter_value_type(f"span.{member}") == "number"
    assert _get_named_filter_value_type("span.nope") is None
