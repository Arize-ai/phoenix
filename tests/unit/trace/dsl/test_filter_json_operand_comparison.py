"""Comparing one JSON value against another, where the backends disagree.

Comparing a JSON value against a *literal* is settled: the literal fixes the
type, and both dialects extract and compare in that type. Comparing two JSON
values fixes nothing -- neither side has a type until the row is read -- so the
comparison happens in whatever type the extraction happens to produce, and the
two backends produce different ones.

PostgreSQL's `#>>` renders both sides as jsonb text. Object key order is
canonical in jsonb, so reordered objects compare equal, while `1` and `1.0`
render as distinct strings. SQLite's `json_extract` returns native SQL values,
so `1 = 1.0` compares numerically and matches, and `true` arrives as `1`.

None of this is reachable when a key is compared against itself: both sides are
the same expression over the same row, so they render identically whatever the
rule. It needs two different keys.

These are pinned, not fixed. Agreement requires knowing the JSON *type* at
comparison time, which extraction has already discarded -- the same obstacle as
`test_json_booleans_as_numbers_is_a_known_divergence`, and the same remedy:
thread the jsonpath down instead of the extracted value.

Ordered comparison (`<`, `<=`, `>`, `>=`) between two JSON operands is the
exception: it is *defined*, not pinned. Text ordering would not merely disagree
on near-equivalent encodings -- it inverts numeric order (`'9' > '10'` as text,
`9 < 10` as numbers) -- so both sides take the total numeric conversion instead,
and a row with no number on either side drops out.
"""

from datetime import datetime, timezone
from typing import Any

import pytest
from sqlalchemy import insert, select

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.filter import SpanFilter

_TS = datetime(2026, 1, 1, tzinfo=timezone.utc)

# Every row holds both keys, so nothing here is a NULL comparison: `==` and
# `!=` must partition the rows on each backend.
_SPANS: dict[str, dict[str, Any]] = {
    # Same members, different insertion order.
    "keyorder": {"p": {"x": 1, "y": 2}, "q": {"y": 2, "x": 1}},
    # A JSON number and the JSON string that spells it.
    "numstr": {"p": 1, "q": "1"},
    # Same number, different JSON spelling.
    "numform": {"p": 1, "q": 1.0},
    # A boolean against the integer it collapses to.
    "numbool": {"p": 1, "q": True},
    # The control: identical values, which must match everywhere.
    "same": {"p": "v", "q": "v"},
}

# Rows for ordered comparison, kept separate so the equality tests above keep
# their exact expected sets.
_ORDERED_SPANS: dict[str, dict[str, Any]] = {
    # The inversion case: as text, '9' > '10'; as numbers, 9 < 10.
    "inversion": {"p": 9, "q": 10},
    # Different JSON spellings of the same number order as equal.
    "equal": {"p": 1, "q": 1.0},
    # A numeric string converts on both backends (pinned by the hostile-data
    # suite) and participates in numeric order.
    "numstr": {"p": "12", "q": 3},
    # No number on either side: the row drops out of every ordered comparison.
    "text": {"p": "a", "q": "b"},
}


@pytest.fixture
async def json_operand_project(db: DbSessionFactory) -> None:
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="json-operands").returning(models.Project.id)
        )
        trace_id = await session.scalar(
            insert(models.Trace)
            .values(project_rowid=project_id, trace_id="t", start_time=_TS, end_time=_TS)
            .returning(models.Trace.id)
        )
        for span_id, attributes in _SPANS.items():
            await session.execute(
                insert(models.Span).values(
                    trace_rowid=trace_id,
                    span_id=span_id,
                    parent_id=None,
                    name="n",
                    span_kind="LLM",
                    start_time=_TS,
                    end_time=_TS,
                    attributes=attributes,
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )


@pytest.fixture
async def json_ordering_project(db: DbSessionFactory) -> None:
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="json-ordering").returning(models.Project.id)
        )
        trace_id = await session.scalar(
            insert(models.Trace)
            .values(project_rowid=project_id, trace_id="t-ord", start_time=_TS, end_time=_TS)
            .returning(models.Trace.id)
        )
        for span_id, attributes in _ORDERED_SPANS.items():
            await session.execute(
                insert(models.Span).values(
                    trace_rowid=trace_id,
                    span_id=span_id,
                    parent_id=None,
                    name="n",
                    span_kind="LLM",
                    start_time=_TS,
                    end_time=_TS,
                    attributes=attributes,
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )


async def _matches(db: DbSessionFactory, condition: str) -> set[str]:
    async with db() as session:
        return set(await session.scalars(SpanFilter(condition)(select(models.Span.span_id))))


async def test_membership_between_two_json_values_is_a_known_divergence(
    db: DbSessionFactory,
    json_operand_project: None,
    dialect: str,
) -> None:
    """`in` between two JSON operands is substring containment over the two
    text renderings, so it inherits every rendering difference equality has --
    boolean spellings, key order, numeric formatting -- plus partial-match
    effects of its own. Pinned per backend, not fixed: like two-JSON equality,
    agreement would require the JSON type extraction has already discarded.
    """
    contained = await _matches(db, "attributes['p'] in attributes['q']")
    if dialect == "sqlite":
        # Native extraction: `true` collapses to 1 before the containment
        # sees it, so the boolean row matches a numeric needle.
        assert contained == {"numstr", "numform", "numbool", "same"}
    else:
        # jsonb text: canonical key order makes the reordered objects render
        # identically, while `true` stays `true` and does not contain `1`.
        assert contained == {"keyorder", "numstr", "numform", "same"}


async def test_ordered_comparison_of_two_json_values_is_numeric_on_every_backend(
    db: DbSessionFactory,
    json_ordering_project: None,
) -> None:
    """Order between two JSON operands is defined numerically, not pinned.

    Extracted as text, PostgreSQL would report `'9' > '10'` as true while
    SQLite compares native numbers -- the same stored values ordering
    oppositely, which is worse than the equality skew above: not a disagreement
    about near-equivalent encodings, but an inverted answer over plain
    integers. Both sides therefore take the total numeric conversion, and the
    expected sets below must hold identically on each backend.
    """
    assert await _matches(db, "attributes['p'] < attributes['q']") == {"inversion"}
    assert await _matches(db, "attributes['p'] > attributes['q']") == {"numstr"}
    assert await _matches(db, "attributes['p'] <= attributes['q']") == {"inversion", "equal"}
    assert await _matches(db, "attributes['p'] >= attributes['q']") == {"numstr", "equal"}


async def test_comparing_two_json_values_is_a_known_divergence(
    db: DbSessionFactory,
    json_operand_project: None,
    dialect: str,
) -> None:
    equal = await _matches(db, "attributes['p'] == attributes['q']")
    if dialect == "sqlite":
        # Native values: 1 == 1.0 numerically, and `true` extracts as 1.
        # Objects come back as text with their stored key order.
        assert equal == {"numform", "numbool", "same"}
    else:
        # jsonb text: key order is canonical, but `1` and `1.0` are not the
        # same string, and neither are `1` and `true`. `numstr` matches here and
        # not on SQLite for the same reason -- comparing text, `1` and `"1"` are
        # both `1`.
        assert equal == {"keyorder", "numstr", "same"}


async def test_equality_and_inequality_still_partition(
    db: DbSessionFactory,
    json_operand_project: None,
) -> None:
    """The backends disagree on *which* rows, not on whether the answer is total.

    Every key here is present, so no operand is NULL and three-valued logic does
    not apply. Whatever `==` claims, `!=` must claim exactly the rest -- a
    divergence that also lost rows would be a defect rather than a difference.
    """
    equal = await _matches(db, "attributes['p'] == attributes['q']")
    unequal = await _matches(db, "attributes['p'] != attributes['q']")
    assert equal | unequal == set(_SPANS)
    assert not (equal & unequal)


async def test_identical_values_match_on_every_backend(
    db: DbSessionFactory,
    json_operand_project: None,
) -> None:
    # The floor under the divergence: whatever the extraction rule, two equal
    # values compare equal. If this breaks, the comparison is broken, not merely
    # dialect-dependent.
    assert "same" in await _matches(db, "attributes['p'] == attributes['q']")


async def test_a_key_compared_against_itself_cannot_diverge(
    db: DbSessionFactory,
    json_operand_project: None,
) -> None:
    """Self-comparison is an existence test, not an equality test.

    Both sides are the same expression over the same row, so they render
    identically under either backend's rule. What it actually asks is whether
    the value is non-NULL -- which `is not None` asks directly, and cheaply.
    """
    assert await _matches(db, "attributes['p'] == attributes['p']") == set(_SPANS)
    assert await _matches(db, "attributes['p'] == attributes['p']") == await _matches(
        db, "attributes['p'] is not None"
    )
    # An absent key is NULL, and NULL is not equal to itself. The tautology, its
    # negation, and its `not` are all empty -- only `is None` can ask this.
    assert await _matches(db, "attributes['gone'] == attributes['gone']") == set()
    assert await _matches(db, "attributes['gone'] != attributes['gone']") == set()
    assert await _matches(db, "not (attributes['gone'] == attributes['gone'])") == set()
    assert await _matches(db, "attributes['gone'] is None") == set(_SPANS)


async def test_json_number_against_a_string_literal_is_a_known_divergence(
    db: DbSessionFactory,
    json_operand_project: None,
    dialect: str,
) -> None:
    """A stored JSON number compared to a quoted literal.

    PostgreSQL extracts to text and compares text, so `1` matches `'1'`. SQLite
    extracts a native number and compares it against a text literal, which its
    type rules make false. A stored JSON *string* matches on both, so the
    divergence is confined to values whose JSON type differs from the literal's.

    Not specific to `str()`: the cast is a no-op over an operand whose type is
    unknown, so `attributes['p'] == '1'` and `str(attributes['p']) == '1'`
    behave identically. Substring search agrees on both backends, which is what
    keeps `'x' in str(metadata['k'])` -- the one shape this cast is actually
    used for -- portable.
    """
    numeric = await _matches(db, "attributes['p'] == '1'")
    assert await _matches(db, "str(attributes['p']) == '1'") == numeric
    if dialect == "sqlite":
        assert "numstr" not in numeric
    else:
        assert "numstr" in numeric
    # The JSON string spelling matches everywhere, and so does substring search.
    assert "numstr" in await _matches(db, "attributes['q'] == '1'")
    assert "numstr" in await _matches(db, "'1' in str(attributes['p'])")
