from datetime import datetime, timedelta
from typing import Any

import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types import FilterVocabularyTerm as vocabulary_module
from phoenix.server.api.types.FilterVocabularyTerm import trace_filter_vocabulary_terms
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.trace_filter import TRACE_BINDINGS, TRACE_FILTER_DESCRIPTIONS
from tests.unit._helpers import _add_project, _add_span, _add_trace
from tests.unit.graphql import AsyncGraphQLClient


def _project_id(project: models.Project) -> str:
    return str(GlobalID("Project", str(project.id)))


def _trace_annotation(trace: models.Trace, name: str) -> models.TraceAnnotation:
    return models.TraceAnnotation(
        trace_rowid=trace.id,
        name=name,
        label="yes",
        score=1.0,
        explanation=None,
        metadata_={},
        annotator_kind="HUMAN",
        source="APP",
    )


async def test_validate_trace_filter_condition(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        session.add(_trace_annotation(trace, "quality"))

    query = """
        query($id: ID!, $condition: String!) {
          node(id: $id) {
            ... on Project {
              validateTraceFilterCondition(condition: $condition) {
                isValid
                errorMessage
                warnings
              }
            }
          }
        }
    """

    async def validate(condition: str) -> dict[str, Any]:
        response = await gql_client.execute(
            query=query,
            variables={"id": _project_id(project), "condition": condition},
        )
        assert not response.errors
        assert response.data is not None
        result: dict[str, Any] = response.data["node"]["validateTraceFilterCondition"]
        return result

    valid = await validate('error_count > 0 and any(span.status_code == "ERROR" for span in spans)')
    assert valid == {"isValid": True, "errorMessage": None, "warnings": []}

    invalid = await validate("num_spans >")
    assert invalid["isValid"] is False
    assert invalid["errorMessage"]

    unknown = await validate("annotations['qualty'].score > 0.5")
    assert unknown["isValid"] is True
    assert unknown["errorMessage"] is None
    assert any("unknown annotation name 'qualty'" in warning for warning in unknown["warnings"])
    assert any("quality" in warning for warning in unknown["warnings"])


async def test_trace_filter_vocabulary_is_compiler_derived_and_project_scoped(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    start = datetime.fromisoformat("2024-01-01T00:00:00+00:00")
    end = start + timedelta(hours=2)
    async with db() as session:
        project = await _add_project(session)

        before = await _add_trace(
            session,
            project,
            start_time=start - timedelta(minutes=1),
            end_time=start,
        )
        await _add_span(session, before, attributes={"before": "excluded"})
        session.add(_trace_annotation(before, "before_annotation"))

        included = await _add_trace(
            session,
            project,
            start_time=start,
            end_time=start + timedelta(minutes=1),
        )
        root_span = await _add_span(
            session,
            included,
            attributes={"included": {"leaf": "yes"}},
        )
        child_span = await _add_span(
            session,
            parent_span=root_span,
            attributes={"child_only": "excluded"},
        )
        session.add(_trace_annotation(included, "quality"))
        session.add(
            models.SpanAnnotation(
                span_rowid=child_span.id,
                name="span_only",
                label="yes",
                score=1.0,
                explanation=None,
                metadata_={},
                annotator_kind="HUMAN",
                source="APP",
            )
        )

        orphan_trace = await _add_trace(
            session,
            project,
            start_time=start + timedelta(hours=1),
            end_time=start + timedelta(hours=1, minutes=1),
        )
        orphan = await _add_span(session, orphan_trace, attributes={"orphan_only": "excluded"})
        orphan.parent_id = "missing-parent"

        at_end = await _add_trace(session, project, start_time=end, end_time=end)
        await _add_span(session, at_end, attributes={"at_end": "excluded"})
        session.add(_trace_annotation(at_end, "at_end_annotation"))

        other_project = await _add_project(session)
        other_trace = await _add_trace(session, other_project, start_time=start, end_time=start)
        await _add_span(session, other_trace, attributes={"other_project": "excluded"})
        session.add(_trace_annotation(other_trace, "other_annotation"))

    query = """
        query($id: ID!, $timeRange: TimeRange) {
          node(id: $id) {
            ... on Project {
              traceFilterVocabulary(timeRange: $timeRange) {
                name
                type
                description
                category
                iterableName
              }
            }
          }
        }
    """
    response = await gql_client.execute(
        query=query,
        variables={
            "id": _project_id(project),
            "timeRange": {"start": start.isoformat(), "end": end.isoformat()},
        },
    )
    assert not response.errors
    assert response.data is not None
    terms = response.data["node"]["traceFilterVocabulary"]
    top_level_terms = [term for term in terms if term["iterableName"] is None]
    terms_by_name = {term["name"]: term for term in top_level_terms}

    static_names = {
        term["name"] for term in top_level_terms if term["name"] in TRACE_BINDINGS.binding_names
    }
    assert static_names == set(TRACE_BINDINGS.binding_names)
    assert terms_by_name["trace_id"]["category"] == "trace"
    assert terms_by_name["num_spans"]["category"] == "aggregate"
    assert all(term["description"] for term in terms)

    iterable_names = {term["name"] for term in top_level_terms if term["category"] == "iterable"}
    assert iterable_names == set(TRACE_BINDINGS.iterables)
    for iterable_name, grammar in TRACE_BINDINGS.iterables.items():
        expected_fields = set(grammar.element_bindings.binding_names)
        observed_fields = {term["name"] for term in terms if term["iterableName"] == iterable_name}
        assert observed_fields == expected_fields

    assert terms_by_name['attributes["included.leaf"]']["type"] == "string"
    assert terms_by_name['annotations["quality"].score']["type"] == "number"
    assert terms_by_name['annotations["quality"].label']["type"] == "string"
    excluded = {
        'attributes["before"]',
        'attributes["child_only"]',
        'attributes["orphan_only"]',
        'attributes["at_end"]',
        'attributes["other_project"]',
        'annotations["before_annotation"].score',
        'annotations["at_end_annotation"].score',
        'annotations["other_annotation"].score',
        'annotations["span_only"].score',
    }
    assert excluded.isdisjoint(terms_by_name)


def test_trace_filter_vocabulary_requires_descriptions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    descriptions = dict(TRACE_FILTER_DESCRIPTIONS)
    descriptions.pop("trace_id")
    monkeypatch.setattr(vocabulary_module, "TRACE_FILTER_DESCRIPTIONS", descriptions)

    with pytest.raises(KeyError, match="trace_id"):
        trace_filter_vocabulary_terms()
