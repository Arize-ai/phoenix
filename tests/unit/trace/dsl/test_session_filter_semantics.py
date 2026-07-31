"""The accepted surface of the session filter language, as a corpus.

Two tables and one rule each. `REJECTED` pairs a condition with the phrase its `SyntaxError` must
carry, so a form the language does not mean cannot start compiling by accident. `ACCEPTED` lists
conditions that must compile *and execute*: rendering under both dialects catches generation
failures, not execution failures, so every accepted row is run against a seeded database under both
lowerings on whichever dialect the suite is pointed at.

Row-set semantics for the accepted forms live in the differential suite against the reference
evaluator (`test_session_filter.py`); this module fixes what the language accepts at all.
"""

from ast import unparse
from datetime import datetime, timedelta, timezone

import pytest
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import select

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.filter import SpanFilter
from phoenix.trace.dsl.session_filter import FilterLowering, SessionFilter
from tests.unit._helpers import _add_project, _add_project_session, _add_span, _add_trace

_INPUT_VALUE = SpanAttributes.INPUT_VALUE.split(".")
_OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE.split(".")

REJECTED: tuple[tuple[str, str], ...] = (
    # -- Comparison and membership operands resolve to a compatible type ---------------------
    ("session_id == 1", "cannot compare"),
    ("start_time >= 1", "cannot compare"),
    ("num_traces == True", "cannot compare"),
    ("session_id == True", "cannot compare"),
    ("start_time > session_id", "cannot compare"),
    # Text has no cross-dialect ordering, so `<`/`>` refuse it wherever it comes from.
    ("first_input > last_output", "does not order text"),
    ("session_id >= 'm'", "does not order text"),
    ("annotations['q'].label < 'good'", "does not order text"),
    ("attributes['llm.model_name'] > 'gpt'", "does not order text"),
    ("any(s.name > 'a' for s in spans)", "does not order text"),
    ("any(d.is_prompt > False for d in span_cost_details)", "does not order a condition"),
    ("num_traces > 'five'", "cannot compare"),
    # Membership acceptance may not depend on element order: both spellings are one rule.
    ("num_traces in (1, '2')", "cannot compare number and string"),
    ("num_traces in ('2', 1)", "cannot compare number and string"),
    ("session_id in (1, 2)", "a list is all text or all numbers"),
    ("session_id in ('a', 1)", "cannot compare number and string"),
    ("attributes['k'] in [1, 'a']", "cannot compare number and string"),
    ("metadata['k'] in ['a', 1]", "cannot compare number and string"),
    ("1 in [1, 2]", "compares two literals"),
    ("'a' in ['a', 'b']", "compares two literals"),
    ("start_time in ['2026-07-01']", "cannot be looked up in a list"),
    # A naive datetime literal has no portable reading; the offset is required.
    ("start_time > '2026-07-01'", "has no timezone"),
    # -- Boolean contexts -------------------------------------------------------------------
    ("not num_traces", "expected a condition"),
    ("not session_id", "expected a condition"),
    ("num_traces and session_id == 'a'", "expected a condition"),
    ("any(s.latency_ms for s in spans)", "`any(...)` takes a condition"),
    ("any(s.status_code == 'ERROR' for s in spans) * 2 > 1", "expected a number"),
    # -- `is` is identity in Python and cannot mean equality here ---------------------------
    ("session_id is 'abc'", "compare against None only"),
    ("num_traces is not 5", "compare against None only"),
    ("first_input < None", "cannot compare against None"),
    # -- Operator allowlist -----------------------------------------------------------------
    ("num_traces_with_error // num_traces > 0", "not a supported operator"),
    ("num_traces ** 2 > 1", "not a supported operator"),
    ("num_traces << 1 > 2", "not a supported operator"),
    ("num_traces >> 1 > 2", "not a supported operator"),
    ("num_traces & 1 > 2", "not a supported operator"),
    ("num_traces | 1 > 2", "not a supported operator"),
    ("num_traces ^ 1 > 2", "not a supported operator"),
    ("num_traces @ 2 > 1", "not a supported operator"),
    ("~num_traces == 1", "unsupported operator"),
    ("+session_id == 1", "expected a number"),
    ("session_id * 2 == 'xx'", "expected a number"),
    ("session_id + 'x' == 'ax'", "expected a number"),
    ("attributes['n'] * 2 > 1", "cast it with `float(attributes['n'])`"),
    # -- Literal and container domain -------------------------------------------------------
    ("session_id == b'abc'", "unsupported literal"),
    ("num_traces == 1j", "unsupported literal"),
    ("session_id == ...", "unsupported literal"),
    ("num_traces < 1e400", "invalid numeric literal"),
    ("session_id == 'a\\x00b'", "NUL character"),
    ("session_id == 'a\x00b'", "NUL character"),
    ("session_id == ('a', 'b')", "compares with `in` / `not in` only"),
    ("session_id in [['a']]", "holds literal values only"),
    ("session_id in [session_id]", "holds literal values only"),
    # Set literals stay deferred: admitting the spelling later is purely additive.
    ("session_id in {'a', 'b'}", "invalid expression"),
    # -- Casts -------------------------------------------------------------------------------
    ("num_traces > int(1.9)", "would not truncate"),
    ("session_id == str(1)", "casts a term, not a literal"),
    ("float('abc') > 1", "casts a term, not a literal"),
    ("float(any(s.name == 'x' for s in spans)) > 0", "cannot cast a condition"),
    ("str(num_traces) == '1'", "cannot cast a number"),
    ("float(session_id) > 1", "cannot cast text"),
    ("str(start_time) == 'x'", "cannot cast a timestamp"),
    # -- Containment operands -----------------------------------------------------------------
    ("'x' in duration_ms", "`in` searches text or a list"),
    ("'x' in start_time", "`in` searches text or a list"),
    ("'x' in num_traces", "`in` searches text or a list"),
    ("session_id in first_input", "searched for a text literal"),
    ("1 in session_id", "searched for a text literal"),
    ("first_input in last_output", "searched for a text literal"),
    ("session_id in any_input", "searched for a text literal"),
    ("3 in any_input", "searched for a text literal"),
    ("num_traces in any_output", "searched for a text literal"),
    ("str(num_traces) in first_input", "searched for a text literal"),
    # -- Dotted roots resolve strictly ---------------------------------------------------------
    ("usr.id == 'u1'", "invalid name `usr.id`"),
    ("metadata.tier == 'gold'", "invalid name `metadata.tier`"),
    ("user.name == 'x'", "invalid name `user.name`"),
    ("llm.model_name == 'gpt-4o'", "invalid name `llm.model_name`"),
    ("attributes == 'x'", "invalid name `attributes`"),
    ("metadata == 'x'", "invalid name `metadata`"),
    # -- Reduction signatures -------------------------------------------------------------------
    ("sum(s.name for s in spans) > 0", "reduces numbers"),
    ("sum(s.span_kind for s in spans) > 0", "reduces numbers"),
    ("max(s.name for s in spans) == 'x'", "reduces numbers"),
    ("min(a.label for a in session_annotations) == 'good'", "reduces numbers"),
    ("max(t.start_time for t in traces) > '2026-07-01'", "reduces numbers"),
    # A boolean element field and a nested quantifier are condition-shaped, so the reduction
    # rejects them one step earlier, as the wrong shape rather than the wrong type.
    ("sum(d.is_prompt for d in span_cost_details) > 1", "`sum(...)` takes a value"),
    ("sum(any(s.name == 'x' for s in t.spans) for t in traces) > 0", "`sum(...)` takes a value"),
    # -- Comprehension nesting and scope --------------------------------------------------------
    (
        "any(any(s.name == 'x' for s in spans) for t in traces)",
        "`spans` cannot be iterated inside a comprehension; a traces element iterates `t.spans`",
    ),
    (
        "any(any(a.name == 'x' for a in session_annotations) for t in traces)",
        "`session_annotations` cannot be iterated inside a comprehension",
    ),
    (
        "len([s for s in spans if any(x.name == s.name for x in spans)]) > 0",
        "`spans` cannot be iterated inside a comprehension",
    ),
    (
        "any(s.name == 'x' for s in spans if any(t.latency_ms > 0 for t in traces))",
        "`traces` cannot be iterated inside a comprehension",
    ),
    (
        "any(first_input == 'x' for s in spans)",
        "`first_input` is a top-level term, not a spans element field",
    ),
    (
        "any(s.latency_ms > duration_ms for s in spans)",
        "`duration_ms` is a top-level term, not a spans element field",
    ),
    (
        "any(annotations['q'].score > 0.5 for s in spans)",
        "session_annotations",
    ),
    # -- Source spelling -------------------------------------------------------------------------
    ("ｓｅｓｓｉｏｎ＿ｉｄ == 'a'", "use unaccented ASCII"),
    ("ｕｓｅｒ.ｉｄ == 'u1'", "use unaccented ASCII"),
    # -- A condition has to be a condition -----------------------------------------------------
    ("num_traces", "is not a condition"),
    ("first_input", "is not a condition"),
    ("not (num_traces)", "expected a condition"),
)

ACCEPTED: tuple[str, ...] = (
    # Intrinsics, aggregates, and their arithmetic.
    "session_id == 'corpus'",
    "session_id != 'other'",
    "num_traces >= 1",
    "1 < num_traces < 100",
    "duration_ms > 0 and num_traces > 0",
    "num_traces_with_error / num_traces > 0.2",
    "-duration_ms < 0",
    "+num_traces >= 1",
    "token_count_total - token_count_prompt >= 0",
    "start_time > '2026-07-01T00:00:00+00:00'",
    "end_time < '2027-01-01T00:00:00+00:00'",
    "start_time <= end_time",
    # Containment, including the empty-collection forms, whose Python meaning (always false /
    # always true) SQLAlchemy's empty-set rewrites carry to both dialects.
    "'corp' in session_id",
    "'corp' not in session_id",
    "session_id in ['corpus', 'other']",
    "session_id not in ('other',)",
    "num_traces in [1, 2, 3]",
    "session_id in []",
    "session_id not in ()",
    "num_traces in []",
    # Root-span reads.
    "'hello' in any_input",
    "'bye' not in any_output",
    "'hello' in first_input",
    "'bye' in last_output",
    "first_input is None",
    "last_output is not None",
    "user.id == 'u1'",
    "metadata['tier'] == 'gold'",
    "attributes['llm.model_name'] == 'gpt-4o'",
    "attributes['llm']['model_name'] == 'gpt-4o'",
    "'gpt' in attributes['llm.model_name']",
    "attributes['llm.model_name'] is None",
    "float(attributes['retry_count']) > 1",
    "str(attributes['retry_count']) == '2'",
    "attributes['streamed'] == True",
    # Annotations, by point access and by iteration.
    "annotations['Quality']",
    "annotations['Quality'].score > 0.5",
    "annotations['Quality'].label == 'good'",
    "annotations['Quality'].score is None",
    "any(a.name == 'Quality' and a.score > 0.5 for a in session_annotations)",
    "all(a.score is not None for a in session_annotations)",
    "any(a.label == 'correct' for a in span_annotations)",
    # Comprehensions across the iterables, both quantifiers and every reduction.
    "any(s.status_code == 'ERROR' for s in spans)",
    "all(s.latency_ms < 100000 for s in spans)",
    "not any(s.name == 'missing' for s in spans)",
    "len([s for s in spans if s.span_kind == 'TOOL']) >= 0",
    "sum(s.llm_token_count_prompt for s in spans) >= 0",
    "max(s.latency_ms for s in spans) > 0",
    "min(s.latency_ms for s in spans) > 0",
    "max(s.latency_ms for s in spans) is None",
    "any('sea' in s.name for s in spans)",
    "any(s.name in ['search', 'chat'] for s in spans)",
    "any(t.latency_ms > 0 for t in traces)",
    "any(t.start_time > '2026-07-01T00:00:00Z' for t in traces)",
    "any(any(s.span_kind == 'TOOL' for s in t.spans) for t in traces)",
    "all(any(s.span_kind == 'LLM' for s in t.spans) for t in traces)",
    "any(d.is_prompt == True for d in span_cost_details)",
    "sum(d.tokens for d in span_cost_details if d.token_type == 'input') > 0",
    "len([s for s in spans]) == num_traces or num_traces > 0",
    # Whitespace around a condition is normalized rather than read as indentation.
    "   session_id == 'corpus'   \n",
)


@pytest.mark.parametrize("condition,message", REJECTED, ids=[row[0] for row in REJECTED])
def test_session_filter_rejects_undesigned_forms(condition: str, message: str) -> None:
    with pytest.raises(SyntaxError) as exc_info:
        SessionFilter(condition)
    assert message in str(exc_info.value)


@pytest.mark.parametrize(
    "translated",
    [
        unparse(SpanFilter("+latency_ms > 1").translated),
        unparse(SessionFilter("+num_traces > 1").translated),
    ],
)
def test_unary_plus_never_becomes_minus(translated: str) -> None:
    """Both grains: `+x` is the identity Python defines it to be, never a sign flip.

    Unary plus on a *text* operand (`+name`) is rejected outright by the shared
    arithmetic type rules, so only numeric operands appear here."""
    assert "-" not in translated


async def _seed_corpus_session(db: DbSessionFactory) -> models.Project:
    """One session carrying every relation the corpus reads, so each row executes against rows."""
    start = datetime(2026, 7, 1, 12, 0, tzinfo=timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(
            session,
            project,
            session_id="corpus",
            start_time=start,
            end_time=start + timedelta(seconds=5),
        )
        trace = await _add_trace(
            session,
            project,
            project_session,
            start_time=start,
            end_time=start + timedelta(seconds=5),
        )
        root = await _add_span(
            session,
            trace,
            attributes={
                "llm": {"model_name": "gpt-4o"},
                "user": {"id": "u1"},
                "metadata": {"tier": "gold"},
                "retry_count": 2,
                "streamed": True,
                _INPUT_VALUE[0]: {_INPUT_VALUE[1]: "hello there"},
                _OUTPUT_VALUE[0]: {_OUTPUT_VALUE[1]: "goodbye"},
            },
            start_time=start,
            end_time=start + timedelta(seconds=1),
            llm_token_count_prompt=10,
            llm_token_count_completion=5,
        )
        root.name = "chat"
        tool = await _add_span(
            session,
            trace,
            span_kind="TOOL",
            start_time=start,
            end_time=start + timedelta(seconds=2),
        )
        tool.name = "search"
        session.add(
            models.SpanAnnotation(
                span_rowid=root.id,
                name="Hallucination",
                label="correct",
                score=0.8,
                metadata_={},
                annotator_kind="HUMAN",
                source="APP",
                identifier="",
            )
        )
        session.add(
            models.ProjectSessionAnnotation(
                project_session_id=project_session.id,
                name="Quality",
                label="good",
                score=0.9,
                metadata_={},
                annotator_kind="HUMAN",
                source="APP",
                identifier="",
            )
        )
        span_cost = models.SpanCost(
            span_rowid=root.id,
            trace_rowid=trace.id,
            span_start_time=root.start_time,
            prompt_cost=0.25,
            completion_cost=0.5,
            total_cost=0.75,
        )
        session.add(span_cost)
        await session.flush()
        session.add(
            models.SpanCostDetail(
                span_cost_id=span_cost.id,
                token_type="input",
                is_prompt=True,
                cost=0.25,
                tokens=100.0,
                cost_per_token=0.0025,
            )
        )
        await session.flush()
    return project


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_session_filter_accepted_forms_execute(
    db: DbSessionFactory, lowering: FilterLowering
) -> None:
    """Every accepted form runs on the dialect under test — a rendered statement is not evidence
    that the backend accepts it (a boolean cast to float renders on both and executes on one)."""
    project = await _seed_corpus_session(db)
    async with db() as session:
        for condition in ACCEPTED:
            subquery = SessionFilter(condition).as_session_rowids_subquery(
                project_rowids=[project.id], lowering=lowering
            )
            stmt = select(models.ProjectSession.id).where(models.ProjectSession.id.in_(subquery))
            await session.execute(stmt)


async def test_span_filter_normalizes_outer_whitespace(db: DbSessionFactory) -> None:
    """Shared with the session grain: a leading space is normalized, not an `IndentationError`."""
    async with db() as session:
        await _add_span(session)
        stmt = SpanFilter("  name is not None  ")(select(models.Span.id))
        await session.execute(stmt)
