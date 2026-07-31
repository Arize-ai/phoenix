"""Annotation aliasing, pinned through both grains that share the filter compiler.

`annotations[...]` is rewritten to private relation aliases before the predicate is
compiled. The rewrite is structural, so what it may and may not reach is the same on
either grain: only real annotation expressions, never text that merely spells one.
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
from tests.unit._helpers import _add_project, _add_span, _add_trace

_NIL = "00000000000000000000000000000000"

Grain = Union[type[SpanFilter], type[SessionFilter]]

# Each grain with the table prefix its aliases carry and a string-typed name to search,
# so one expectation covers both compilers.
_GRAINS = [
    pytest.param(SpanFilter, "span_annotation", "name", id="span"),
    pytest.param(SessionFilter, "project_session_annotation", "first_input", id="session"),
]


def _compile(grain: Grain, condition: str) -> Any:
    with patch.object(
        phoenix.trace.dsl.filter,
        "uuid4",
        return_value=UUID(hex=_NIL),
    ):
        return grain(condition)


@pytest.mark.parametrize("grain,prefix,text_name", _GRAINS)
@pytest.mark.parametrize(
    "condition,expected",
    [
        pytest.param(
            "evals['Hallucination'].label == 'correct' or evals['Hallucination'].score < 0.5",
            "or_({p}_0_label_{u} == 'correct', cast({p}_0_score_{u}, Float) < 0.5)",
            id="both-attributes-of-one-name",
        ),
        pytest.param(
            'annotations["Q&A Correctness"].label is not None',
            "{p}_0_label_{u} != None",
            id="double-quoted-annotation-name",
        ),
        pytest.param(
            "evals['Hallucination']",
            "{p}_0_exists_{u}",
            id="bare-reference-is-an-existence-check",
        ),
        pytest.param(
            "annotations['a'].score > 0 and annotations['b'].label == 'x'",
            "and_(cast({p}_0_score_{u}, Float) > 0, {p}_1_label_{u} == 'x')",
            id="distinct-names-take-distinct-relations",
        ),
    ],
)
def test_annotation_expressions_compile_to_relation_aliases(
    grain: Grain,
    prefix: str,
    text_name: str,
    condition: str,
    expected: str,
) -> None:
    compiled = _compile(grain, condition)
    assert unparse(compiled.translated).strip() == expected.format(p=prefix, u=_NIL)


@pytest.mark.parametrize("grain,prefix,text_name", _GRAINS)
def test_annotation_text_inside_a_string_literal_stays_data(
    grain: Grain,
    prefix: str,
    text_name: str,
) -> None:
    # An IO-search DSL invites exactly this input: traces can legitimately contain text
    # describing annotations. The needle has to survive verbatim, and no join may appear.
    needle = 'annotations["q"].score'
    compiled = _compile(grain, f"'{needle}' in {text_name}")
    assert (
        unparse(compiled.translated).strip() == f"CaseInsensitiveContains({text_name}, '{needle}')"
    )
    assert compiled._aliased_annotation_relations == ()


@pytest.mark.parametrize("grain,prefix,text_name", _GRAINS)
@pytest.mark.parametrize(
    "condition,name",
    [
        pytest.param(r'annotations["a\\b"].score > 0', "a\\b", id="backslash"),
        pytest.param(r'annotations["a\"b"].score > 0', 'a"b', id="escaped-quote"),
        pytest.param(r'annotations["a\nb"].score > 0', "a\nb", id="newline"),
        pytest.param('annotations["ünïcødé 名前"].score > 0', "ünïcødé 名前", id="unicode"),
    ],
)
def test_annotation_name_is_the_decoded_literal(
    grain: Grain,
    prefix: str,
    text_name: str,
    condition: str,
    name: str,
) -> None:
    # The join key is the name Python reads, which is the name the validator vouches for.
    # Anything else validates true and then silently matches nothing.
    compiled = _compile(grain, condition)
    assert [relation.name for relation in compiled._aliased_annotation_relations] == [name]


@pytest.mark.parametrize("grain,prefix,text_name", _GRAINS)
@pytest.mark.parametrize(
    "condition",
    [
        'annotations["q"].score.label > 0',
        'annotations["q"].score.label.other > 0',
        'annotations["q"]["k"] > 0',
    ],
)
def test_rejects_traversal_past_an_annotation(
    grain: Grain,
    prefix: str,
    text_name: str,
    condition: str,
) -> None:
    with pytest.raises(SyntaxError) as exc_info:
        _compile(grain, condition)
    message = str(exc_info.value)
    assert "annotations['q']" in message
    assert prefix not in message


@pytest.mark.parametrize("grain,prefix,text_name", _GRAINS)
def test_explanation_is_accepted_and_suggested(
    grain: Grain,
    prefix: str,
    text_name: str,
) -> None:
    # `.explanation` joined the annotation surface with the span filter
    # validation rework (#14295); both grains expose it through the shared
    # aliasing phase, and a near-miss gets the did-you-mean treatment.
    compiled = _compile(grain, 'annotations["q"].explanation == "x"')
    assert [relation.name for relation in compiled._aliased_annotation_relations] == ["q"]
    with pytest.raises(SyntaxError) as exc_info:
        _compile(grain, 'annotations["q"].explanatio == "x"')
    assert "explanation" in str(exc_info.value)


def test_annotation_inside_a_comprehension_points_at_session_annotations() -> None:
    # The annotation join is built at session scope, so it has nothing to bind to one
    # element down; the error names the collection that does read annotations element-wise.
    with pytest.raises(SyntaxError) as exc_info:
        SessionFilter('any(annotations["q"].score > 0 for span in spans)')
    message = str(exc_info.value)
    assert "annotations['q'].score" in message
    assert "session_annotations" in message
    assert "project_session_annotation" not in message


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
