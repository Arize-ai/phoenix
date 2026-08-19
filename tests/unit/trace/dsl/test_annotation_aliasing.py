"""Annotation aliasing, pinned through every grain that shares the filter compiler.

Entity-appropriate annotation accessors are rewritten to private relation aliases before the
predicate is compiled. The rewrite is structural: only real annotation expressions are reached,
never text that merely spells one.
"""

from ast import unparse
from typing import Any, Union
from unittest.mock import patch
from uuid import UUID

import pytest
from sqlalchemy import select

import phoenix.trace.dsl.filter
from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.filter import SpanFilter
from phoenix.trace.dsl.session_filter import SessionFilter
from phoenix.trace.dsl.trace_filter import TraceFilter
from tests.unit._helpers import _add_project, _add_span, _add_trace

_NIL = "00000000000000000000000000000000"

Grain = Union[type[SpanFilter], type[SessionFilter], type[TraceFilter]]

# Each grain with its accessor, alias prefix, and a string-typed name to search.
_GRAINS = [
    pytest.param(SpanFilter, "annotations", "span_annotation", "name", id="span"),
    pytest.param(
        SessionFilter,
        "session_annotations",
        "project_session_annotation",
        "first_input",
        id="session",
    ),
    pytest.param(TraceFilter, "trace_annotations", "trace_annotation", "input", id="trace"),
]


def _compile(grain: Grain, condition: str) -> Any:
    with patch.object(
        phoenix.trace.dsl.filter,
        "uuid4",
        return_value=UUID(hex=_NIL),
    ):
        return grain(condition)


@pytest.mark.parametrize("grain,accessor,prefix,text_name", _GRAINS)
@pytest.mark.parametrize(
    "condition_template,expected",
    [
        pytest.param(
            "{a}['Hallucination'].label == 'correct' or {a}['Hallucination'].score < 0.5",
            "or_({p}_0_label_{u} == 'correct', cast({p}_0_score_{u}, Float) < 0.5)",
            id="both-attributes-of-one-name",
        ),
        pytest.param(
            '{a}["Q&A Correctness"].label is not None',
            "{p}_0_label_{u} != None",
            id="double-quoted-annotation-name",
        ),
        pytest.param(
            "{a}['Hallucination']",
            "{p}_0_exists_{u}",
            id="bare-reference-is-an-existence-check",
        ),
        pytest.param(
            "{a}['a'].score > 0 and {a}['b'].label == 'x'",
            "and_(cast({p}_0_score_{u}, Float) > 0, {p}_1_label_{u} == 'x')",
            id="distinct-names-take-distinct-relations",
        ),
    ],
)
def test_annotation_expressions_compile_to_relation_aliases(
    grain: Grain,
    accessor: str,
    prefix: str,
    text_name: str,
    condition_template: str,
    expected: str,
) -> None:
    compiled = _compile(grain, condition_template.format(a=accessor))
    assert unparse(compiled.translated).strip() == expected.format(p=prefix, u=_NIL)


@pytest.mark.parametrize("grain,accessor,prefix,text_name", _GRAINS)
def test_annotation_text_inside_a_string_literal_stays_data(
    grain: Grain,
    accessor: str,
    prefix: str,
    text_name: str,
) -> None:
    # An IO-search DSL invites exactly this input: traces can legitimately contain text
    # describing annotations. The needle has to survive verbatim, and no join may appear.
    needle = f'{accessor}["q"].score'
    compiled = _compile(grain, f"'{needle}' in {text_name}")
    assert (
        unparse(compiled.translated).strip() == f"CaseInsensitiveContains({text_name}, '{needle}')"
    )
    assert compiled._aliased_annotation_relations == ()


@pytest.mark.parametrize("grain,accessor,prefix,text_name", _GRAINS)
@pytest.mark.parametrize(
    "condition_template,name",
    [
        pytest.param(r'{a}["a\\b"].score > 0', "a\\b", id="backslash"),
        pytest.param(r'{a}["a\"b"].score > 0', 'a"b', id="escaped-quote"),
        pytest.param(r'{a}["a\nb"].score > 0', "a\nb", id="newline"),
        pytest.param('{a}["ünïcødé 名前"].score > 0', "ünïcødé 名前", id="unicode"),
    ],
)
def test_annotation_name_is_the_decoded_literal(
    grain: Grain,
    accessor: str,
    prefix: str,
    text_name: str,
    condition_template: str,
    name: str,
) -> None:
    # The join key is the name Python reads, which is the name the validator vouches for.
    # Anything else validates true and then silently matches nothing.
    compiled = _compile(grain, condition_template.format(a=accessor))
    assert [relation.name for relation in compiled._aliased_annotation_relations] == [name]


@pytest.mark.parametrize("grain,accessor,prefix,text_name", _GRAINS)
@pytest.mark.parametrize(
    "condition_template",
    [
        '{a}["q"].score.label > 0',
        '{a}["q"].score.label.other > 0',
        '{a}["q"]["k"] > 0',
    ],
)
def test_rejects_traversal_past_an_annotation(
    grain: Grain,
    accessor: str,
    prefix: str,
    text_name: str,
    condition_template: str,
) -> None:
    with pytest.raises(SyntaxError) as exc_info:
        _compile(grain, condition_template.format(a=accessor))
    message = str(exc_info.value)
    assert f"{accessor}['q']" in message
    assert f"{prefix}_0_" not in message


@pytest.mark.parametrize("grain,accessor,prefix,text_name", _GRAINS)
def test_explanation_is_accepted_and_suggested(
    grain: Grain,
    accessor: str,
    prefix: str,
    text_name: str,
) -> None:
    # `.explanation` joined the annotation surface with the span filter
    # validation rework (#14295); all grains expose it through the shared
    # aliasing phase, and a near-miss gets the did-you-mean treatment.
    compiled = _compile(grain, f'{accessor}["q"].explanation == "x"')
    assert [relation.name for relation in compiled._aliased_annotation_relations] == ["q"]
    with pytest.raises(SyntaxError) as exc_info:
        _compile(grain, f'{accessor}["q"].explanatio == "x"')
    assert "explanation" in str(exc_info.value)


def test_annotation_inside_a_comprehension_points_at_session_annotations() -> None:
    # The annotation join is built at session scope, so it has nothing to bind to one
    # element down; the error names the collection that does read annotations element-wise.
    with pytest.raises(SyntaxError) as exc_info:
        SessionFilter('any(session_annotations["q"].score > 0 for span in spans)')
    message = str(exc_info.value)
    assert "session_annotations['q'].score" in message
    assert "session_annotations" in message
    assert "project_session_annotation" not in message


@pytest.mark.parametrize(
    "condition",
    [
        "annotations['q'].score > 0",
        "evals['q'].label == 'x'",
        "trace_annotations['q']",
    ],
)
def test_span_filter_keeps_legacy_annotation_accessors(condition: str) -> None:
    _compile(SpanFilter, condition)


@pytest.mark.parametrize(
    "grain,condition,message",
    [
        pytest.param(
            TraceFilter,
            "annotations['q'].score > 0",
            "`annotations[...]` is not available in the trace filter; use "
            "`trace_annotations[...]` for trace annotations, or iterate "
            "`span_annotations` for span-level annotations",
            id="trace-annotations",
        ),
        pytest.param(
            TraceFilter,
            "evals['q'].score > 0",
            "`evals[...]` is not available in the trace filter; use "
            "`trace_annotations[...]` for trace annotations, or iterate "
            "`span_annotations` for span-level annotations",
            id="trace-evals",
        ),
        pytest.param(
            SessionFilter,
            "annotations['q'].score > 0",
            "`annotations[...]` is not available in the session filter; use "
            "`session_annotations[...]` for session annotations, or iterate "
            "`span_annotations` for span-level annotations",
            id="session-annotations",
        ),
        pytest.param(
            SessionFilter,
            "evals['q'].score > 0",
            "`evals[...]` is not available in the session filter; use "
            "`session_annotations[...]` for session annotations, or iterate "
            "`span_annotations` for span-level annotations",
            id="session-evals",
        ),
        pytest.param(
            SessionFilter,
            "trace_annotations['q'].score > 0",
            "`trace_annotations[...]` is not available in the session filter; sessions "
            "do not expose a trace-annotation accessor; use `session_annotations[...]` "
            "for session annotations, or iterate `span_annotations` for span-level annotations",
            id="session-trace-annotations",
        ),
    ],
)
def test_rejects_annotation_accessors_outside_their_grain(
    grain: Grain,
    condition: str,
    message: str,
) -> None:
    with pytest.raises(SyntaxError) as exc_info:
        _compile(grain, condition)
    assert str(exc_info.value) == message


async def test_span_filter_annotation_conditions_return_the_same_rows(
    db: DbSessionFactory,
) -> None:
    """Every previously-valid annotation form still selects what it selected before."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        hallucinated = await _add_span(session, trace)
        faithful = await _add_span(session, trace)
        unannotated = await _add_span(session, trace)
        session.add_all(
            [
                models.SpanAnnotation(
                    span_rowid=hallucinated.id,
                    name="Hallucination",
                    label="hallucinated",
                    score=0.9,
                    annotator_kind="LLM",
                    source="APP",
                    identifier="",
                    metadata_={},
                ),
                models.SpanAnnotation(
                    span_rowid=faithful.id,
                    name="Hallucination",
                    label="faithful",
                    score=0.1,
                    annotator_kind="LLM",
                    source="APP",
                    identifier="",
                    metadata_={},
                ),
                models.SpanAnnotation(
                    span_rowid=faithful.id,
                    name='escaped "name"',
                    score=1.0,
                    annotator_kind="LLM",
                    source="APP",
                    identifier="",
                    metadata_={},
                ),
            ]
        )
        await session.flush()

        async def matched(condition: str) -> set[int]:
            span_filter = SpanFilter(condition)
            stmt = span_filter(select(models.Span.id).join(models.Trace))
            return set(await session.scalars(stmt.where(models.Trace.project_rowid == project.id)))

        assert await matched("evals['Hallucination'].score > 0.5") == {hallucinated.id}
        assert await matched("evals['Hallucination'].label == 'faithful'") == {faithful.id}
        assert await matched("annotations['Hallucination']") == {hallucinated.id, faithful.id}
        assert await matched(r'annotations["escaped \"name\""].score > 0') == {faithful.id}
        assert await matched("evals['Hallucination'].score > 2") == set()
        assert unannotated.id not in await matched("annotations['Hallucination']")
