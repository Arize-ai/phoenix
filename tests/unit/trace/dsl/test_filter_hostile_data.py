"""Filter behavior against values chosen to break the translation.

A clean fixture never exercises a cast, and an empty one exercises nothing at
all -- a per-row failure cannot happen where there are no rows. Every value here
is one some part of the DSL has to survive: text where a number is expected, all
three JSON boolean encodings, nulls, containers where scalars belong, multi-byte
keys and annotation names.

These assert exact `span_id` sets rather than counts, and the suite runs under
both `--db sqlite` and `--db postgresql`. That combination is what makes them a
cross-dialect guarantee: comparing the two backends to each other would pass
whenever both are wrong the same way, while a fixed expectation checked on each
catches divergence and shared defects alike.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import pytest
from sqlalchemy import insert, select

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.filter import SpanFilter

_TS = datetime(2026, 1, 1, tzinfo=timezone.utc)

# (span_id, parent_id, span_kind, status_code, seconds, attributes)
_SPANS: tuple[tuple[str, Optional[str], str, str, int, dict[str, Any]], ...] = (
    # real JSON booleans and a genuinely numeric string
    (
        "s01",
        None,
        "LLM",
        "OK",
        1,
        {
            "r": True,
            "flag": True,
            "num": "1.5",
            "input": {"value": "hello"},
            "deep": {"a": {"b": 1}},
            "arr": [1, 2, 3],
            "uni": "café",
            "dot.key": "v",
            "metadata": {"flag": True, "mixed": 1},
        },
    ),
    # textual booleans, and text that cannot become a number
    (
        "s02",
        None,
        "CHAIN",
        "ERROR",
        2,
        {
            "r": "yes",
            "flag": "true",
            "num": "abc",
            "input": {"value": "world"},
            "deep": {"a": {"b": 2}},
            "arr": ["x"],
            "uni": "naïve",
            "dot.key": "v",
            "metadata": {"flag": "true", "mixed": 2.5},
        },
    ),
    # numeric boolean encoding, underscore literal PostgreSQL rejects, orphan
    (
        "s03",
        "missing-parent-s03",
        "TOOL",
        "UNSET",
        3,
        {
            "r": 1,
            "flag": 1,
            "num": "1_000",
            "input": {"value": "hi"},
            "deep": {"a": {"b": 3}},
            "arr": [],
            "uni": "日本語",
            "dot.key": "v",
            "metadata": {"flag": 1, "mixed": "3"},
        },
    ),
    # JSON null everywhere
    (
        "s04",
        None,
        "RETRIEVER",
        "OK",
        4,
        {
            "r": None,
            "flag": None,
            "num": "nan",
            "input": {"value": None},
            "deep": {},
            "arr": None,
            "uni": "",
            "dot.key": "v",
            "metadata": {"flag": None, "mixed": "abc"},
        },
    ),
    # containers where a scalar is expected
    (
        "s05",
        None,
        "LLM",
        "ERROR",
        5,
        {
            "r": {"nested": True},
            "flag": False,
            "num": "inf",
            "input": {"value": "x"},
            "deep": {"a": None},
            "arr": [[1]],
            "uni": "ünïcodé",
            "dot.key": "v",
            "metadata": {"flag": False, "mixed": True},
        },
    ),
    # empty and whitespace strings, padded numerics, second orphan
    (
        "s06",
        "missing-parent-s06",
        "CHAIN",
        "UNSET",
        6,
        {
            "r": "",
            "flag": "false",
            "num": " 12 ",
            "input": {"value": "  "},
            "deep": {"a": {"b": 0}},
            "arr": [0],
            "uni": " ",
            "dot.key": "v",
            "metadata": {"flag": "false", "mixed": None},
        },
    ),
    # the well-behaved control row
    (
        "s07",
        None,
        "TOOL",
        "OK",
        7,
        {
            "r": 0,
            "flag": 0,
            "num": 42,
            "input": {"value": "ok"},
            "deep": {"a": {"b": 7}},
            "arr": [7],
            "uni": "plain",
            "dot.key": "v",
            "metadata": {"flag": 0, "mixed": [1, 2]},
        },
    ),
    # known-numeric attributes holding text; mixed-case textual boolean
    (
        "s08",
        None,
        "RETRIEVER",
        "ERROR",
        8,
        {
            "r": False,
            "flag": "TRUE",
            "num": "-0.5",
            "input": {"value": "neg"},
            "uni": "x",
            "dot.key": "v",
            "metadata": {"flag": "TRUE", "mixed": {"k": 1}},
            "llm": {"token_count": {"total": "not-a-number", "prompt": "10"}},
        },
    ),
    # carry no annotations, so the LEFT JOIN semantics are exercised
    ("bare01", None, "CHAIN", "OK", 9, {"num": 3}),
    ("bare02", None, "CHAIN", "OK", 10, {"num": 3}),
)

# (span_id, name, label, score)
_ANNOTATIONS: tuple[tuple[str, str, Optional[str], Optional[float]], ...] = (
    ("s01", "quality", "high", 0.1),
    ("s02", "quality", "low", 0.2),
    ("s03", "quality", "100", 0.3),
    ("s04", "quality", "", None),
    ("s05", "quality", "n/a", 0.5),
    ("s06", "quality", "0.5", 0.6),
    ("s07", "quality", "TRUE", 0.7),
    ("s08", "quality", "not-a-number", None),
    ("s01", "hallucination", "no", 0.05),
    ("s02", "hallucination", "yes", 0.10),
    ("s01", "Q&A Correctness", "lbl-1", 0.75),
    ("s02", "Q&A Correctness", "lbl-2", 0.75),
    ("s01", "café", "lbl-1", 0.75),
    ("s02", "café", "lbl-2", 0.75),
    ("s01", "日本語", "lbl-1", 0.75),
    ("s01", "span_annotation_0", "lbl-1", 0.75),
)


@pytest.fixture
async def hostile_project(db: DbSessionFactory) -> None:
    async with db() as session:
        project_rowid = await session.scalar(
            insert(models.Project).values(name="hostile").returning(models.Project.id)
        )
        rowids: dict[str, int] = {}
        for index, (span_id, parent_id, kind, status, seconds, attributes) in enumerate(_SPANS):
            start = _TS + timedelta(minutes=index)
            trace_rowid = await session.scalar(
                insert(models.Trace)
                .values(
                    trace_id=f"hostile-{span_id}",
                    project_rowid=project_rowid,
                    start_time=start,
                    end_time=start + timedelta(seconds=seconds),
                )
                .returning(models.Trace.id)
            )
            rowids[span_id] = await session.scalar(  # type: ignore[assignment]
                insert(models.Span)
                .values(
                    trace_rowid=trace_rowid,
                    span_id=span_id,
                    parent_id=parent_id,
                    name=span_id,
                    span_kind=kind,
                    start_time=start,
                    end_time=start + timedelta(seconds=seconds),
                    attributes=attributes,
                    events=[],
                    status_code=status,
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
                .returning(models.Span.id)
            )
        for span_id, name, label, score in _ANNOTATIONS:
            await session.execute(
                insert(models.SpanAnnotation).values(
                    span_rowid=rowids[span_id],
                    name=name,
                    label=label,
                    score=score,
                    explanation=f"seeded explanation for {span_id}",
                    metadata_={},
                    annotator_kind="HUMAN",
                    identifier="",
                    source="APP",
                )
            )


@pytest.mark.parametrize(
    "condition,expected",
    [
        # --- JSON booleans, in all three encodings, plus null ---
        pytest.param(
            "attributes['flag'] == True",
            ["s01", "s02", "s03", "s08"],
            id="boolean-true-across-encodings",
        ),
        pytest.param(
            "attributes['flag'] == False",
            ["s05", "s06", "s07"],
            id="boolean-false-across-encodings",
        ),
        pytest.param(
            "metadata['flag'] is True", ["s01", "s02", "s03", "s08"], id="metadata-is-true"
        ),
        pytest.param("metadata['flag'] is False", ["s05", "s06", "s07"], id="metadata-is-false"),
        # `is not False` is not the complement: JSON null is in neither
        pytest.param(
            "metadata['flag'] is not False",
            ["s01", "s02", "s03", "s08"],
            id="three-valued-logic",
        ),
        # --- numeric casts over values that cannot be cast ---
        pytest.param(
            "float(attributes['num']) > 1",
            # `"abc"`, `"1_000"`, `"nope"` and the container drop out; `" 12 "`
            # does not -- both backends tolerate surrounding whitespace in the
            # *data*, even though the grammar rejects it in a literal.
            ["bare01", "bare02", "s01", "s06", "s07"],
            id="uncastable-rows-excluded",
        ),
        pytest.param("float(attributes['num']) < 0", ["s08"], id="negative-numeric-string"),
        # a known-numeric attribute holding text excludes its row, not the query
        pytest.param("llm.token_count.total > 5", [], id="numeric-attribute-holding-text"),
        pytest.param("llm.token_count.prompt > 5", ["s08"], id="numeric-attribute-castable"),
        # --- orphans: the two root predicates differ ---
        pytest.param(
            "parent_span is None",
            ["bare01", "bare02", "s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08"],
            id="orphan-aware-root",
        ),
        pytest.param(
            "parent_id is None",
            ["bare01", "bare02", "s01", "s02", "s04", "s05", "s07", "s08"],
            id="strict-root",
        ),
        # --- annotations, including names that stress the aliaser ---
        pytest.param("annotations['café'].score > 0.5", ["s01", "s02"], id="multibyte-name"),
        pytest.param("annotations['日本語'].score > 0.5", ["s01"], id="cjk-name"),
        pytest.param(
            "annotations['Q&A Correctness'].label == 'lbl-1'", ["s01"], id="ampersand-name"
        ),
        pytest.param(
            "annotations['span_annotation_0'].score > 0.5", ["s01"], id="alias-lookalike-name"
        ),
        pytest.param(
            "annotations['quality'].score >= 0.5", ["s05", "s06", "s07"], id="annotation-score"
        ),
        pytest.param("annotations['quality'].label == ''", ["s04"], id="empty-label"),
        pytest.param("annotations['hallucination']", ["s01", "s02"], id="existence-check-partial"),
        pytest.param(
            "annotations['quality'].score > 0 and annotations['hallucination'].label == 'yes'",
            ["s02"],
            id="two-annotation-joins",
        ),
        # --- nested paths, unicode values, dotted keys ---
        pytest.param("attributes['deep']['a']['b'] == 1", ["s01"], id="nested-path"),
        pytest.param("attributes['uni'] == 'café'", ["s01"], id="unicode-value"),
        pytest.param(
            "attributes['dot.key'] == 'v'",
            ["s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08"],
            id="dotted-key",
        ),
        pytest.param("'hello' in input.value", ["s01"], id="substring"),
        # --- one key whose JSON type differs on every row ---
        # s01=1 s02=2.5 s03="3" s04="abc" s05=true s06=null s07=[1,2] s08={"k":1}
        pytest.param("metadata['mixed'] > 1", ["s02", "s03"], id="mixed-numeric"),
        pytest.param("metadata['mixed'] == '3'", ["s03"], id="mixed-string"),
        pytest.param("metadata['mixed'] == 'abc'", ["s04"], id="mixed-non-numeric-string"),
        pytest.param("metadata['mixed'] == True", ["s01", "s05"], id="mixed-boolean"),
        pytest.param("float(metadata['mixed']) > 1", ["s02", "s03"], id="mixed-explicit-cast"),
        pytest.param("'a' in metadata['mixed']", ["s04"], id="mixed-substring"),
        pytest.param("metadata['mixed'] + 1 > 2", ["s02", "s03"], id="mixed-arithmetic"),
    ],
)
async def test_hostile_data_returns_the_same_rows_on_both_backends(
    db: DbSessionFactory,
    hostile_project: None,
    condition: str,
    expected: list[str],
) -> None:
    span_filter = SpanFilter(condition)
    async with db() as session:
        span_ids = sorted(
            await session.scalars(
                span_filter(select(models.Span.span_id)).order_by(models.Span.span_id)
            )
        )
    assert span_ids == sorted(expected)


async def test_json_booleans_as_numbers_is_a_known_divergence(
    db: DbSessionFactory,
    hostile_project: None,
    dialect: str,
) -> None:
    """`metadata['mixed'] >= 0` disagrees across backends, and cannot yet agree.

    `s05` holds JSON `true`. PostgreSQL is right to exclude it -- a boolean is
    not the number 1 -- and does so because `strict $.double()` rejects it.
    SQLite cannot: `json_extract` collapses JSON `true` to the integer 1 before
    `SafeJsonFloat` ever sees the value, and `json_type` can only tell the two
    apart when given the original column and path.

    Closing it means passing the path down rather than the extracted value.
    Until then this records the disagreement so it stays visible, and fails if
    either backend moves.
    """
    async with db() as session:
        span_ids = set(
            await session.scalars(SpanFilter("metadata['mixed'] >= 0")(select(models.Span.span_id)))
        )
    assert {"s01", "s02", "s03"} <= span_ids
    if dialect == "sqlite":
        assert "s05" in span_ids, "SQLite is expected to count JSON true as 1"
    else:
        assert "s05" not in span_ids, "PostgreSQL is expected to reject a boolean"


async def test_is_none_means_no_usable_value_at_the_path(
    db: DbSessionFactory,
    hostile_project: None,
) -> None:
    """`is None` covers a stored JSON null and an absent key alike.

    `s04` holds JSON `null`; `bare01`/`bare02` have no attributes at all. Once a
    value is extracted, no dialect can separate the two -- `json_extract` and
    `->>` both yield SQL NULL -- so the conflation is the only reading both
    backends can express, and it is what someone typing `is None` means.

    A backend that started distinguishing them would be reaching through a
    structure-preserving accessor, which renders values as JSON and makes every
    comparison against them false. That is what this pins.
    """
    async with db() as session:
        is_none = set(
            await session.scalars(
                SpanFilter("attributes['r'] is None")(select(models.Span.span_id))
            )
        )
        is_not_none = set(
            await session.scalars(
                SpanFilter("attributes['r'] is not None")(select(models.Span.span_id))
            )
        )
    assert is_none == {"s04", "bare01", "bare02"}
    # Total: every span is in exactly one side, so neither predicate silently
    # drops rows the other does not claim.
    assert is_not_none == {"s01", "s02", "s03", "s05", "s06", "s07", "s08"}
    assert not (is_none & is_not_none)
