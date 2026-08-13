from datetime import datetime, timedelta
from typing import Any, Literal

import pytest
import sqlalchemy
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


async def test_project_spans_trace_filter_condition_composes_with_span_filter(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        matching_trace = await _add_trace(session, project)
        matching_span = await _add_span(session, matching_trace)
        matching_span.name = "kept"
        other_matching_trace_span = await _add_span(session, matching_trace)
        other_matching_trace_span.name = "discarded"

        non_matching_trace = await _add_trace(session, project)
        non_matching_span = await _add_span(session, non_matching_trace)
        non_matching_span.name = "kept"
        blocked_span = await _add_span(session, non_matching_trace)
        blocked_span.name = "blocked"

    query = """
        query($id: ID!, $spanCondition: String, $traceCondition: String) {
          node(id: $id) {
            ... on Project {
              spans(
                first: 100
                filterCondition: $spanCondition
                traceFilterCondition: $traceCondition
              ) {
                edges { node { id } }
              }
            }
          }
        }
    """
    statements: list[str] = []

    def capture_sql(
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        statements.append(statement)

    sqlalchemy.event.listen(sqlalchemy.engine.Engine, "before_cursor_execute", capture_sql)
    try:
        response = await gql_client.execute(
            query=query,
            variables={
                "id": _project_id(project),
                "spanCondition": "name == 'kept'",
                "traceCondition": 'all(span.name != "blocked" for span in spans)',
            },
        )
    finally:
        sqlalchemy.event.remove(sqlalchemy.engine.Engine, "before_cursor_execute", capture_sql)

    assert not response.errors
    assert response.data is not None
    assert response.data["node"]["spans"]["edges"] == [
        {"node": {"id": str(GlobalID("Span", str(matching_span.id)))}}
    ]
    listing_sql = next(
        " ".join(statement.lower().split())
        for statement in statements
        if "from spans join traces" in " ".join(statement.lower().split())
        and "spans.name" in statement.lower()
    )
    assert "not (exists (select" in listing_sql
    assert "not in (select" not in listing_sql


@pytest.mark.parametrize("broken_tree", ["two_roots", "root_and_orphan"])
async def test_project_trace_filter_keeps_one_representative_root_per_trace(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
    broken_tree: Literal["two_roots", "root_and_orphan"],
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        first_root = await _add_span(session, trace)
        first_root.name = "first-root"
        second_root = await _add_span(session, trace)
        second_root.name = "second-root"
        if broken_tree == "root_and_orphan":
            second_root.parent_id = "missing-parent"

    response = await gql_client.execute(
        query="""
          query($id: ID!) {
            node(id: $id) {
              ... on Project {
                spans(
                  first: 100
                  rootSpansOnly: true
                  orphanSpanAsRootSpan: true
                  sort: {col: startTime, dir: desc}
                  traceFilterCondition: "num_spans > 0"
                ) { edges { node { name } } }
              }
            }
          }
        """,
        variables={"id": _project_id(project)},
    )

    assert not response.errors
    assert response.data is not None
    assert len(response.data["node"]["spans"]["edges"]) == 1


async def test_project_trace_filter_uses_displayed_strict_root(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    start_time = datetime.fromisoformat("2026-07-01T00:00:00+00:00")
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project, start_time=start_time)
        orphan = await _add_span(
            session,
            trace,
            attributes={"input": {"value": "orphan"}},
            start_time=start_time,
        )
        orphan.parent_id = "missing-parent"
        strict_root = await _add_span(
            session,
            trace,
            attributes={"input": {"value": "strict"}},
            start_time=start_time + timedelta(seconds=1),
        )
        strict_root_id = strict_root.id

    response = await gql_client.execute(
        query="""
          query($id: ID!) {
            node(id: $id) {
              ... on Project {
                spans(
                  first: 100
                  rootSpansOnly: true
                  orphanSpanAsRootSpan: false
                  sort: {col: startTime, dir: desc}
                  traceFilterCondition: "input == 'strict'"
                ) { edges { node { id } } }
              }
            }
          }
        """,
        variables={"id": _project_id(project)},
    )

    assert not response.errors
    assert response.data is not None
    assert response.data["node"]["spans"]["edges"] == [
        {"node": {"id": str(GlobalID("Span", str(strict_root_id)))}}
    ]


async def test_project_trace_filter_preserves_trace_start_time_window(
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    window_start = datetime.fromisoformat("2026-07-01T00:00:00+00:00")
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(
            session,
            project,
            start_time=window_start,
            end_time=window_start + timedelta(hours=3),
        )
        root = await _add_span(
            session,
            trace,
            start_time=window_start + timedelta(hours=2),
            end_time=window_start + timedelta(hours=3),
        )

    response = await gql_client.execute(
        query="""
          query($id: ID!, $timeRange: TimeRange!) {
            node(id: $id) {
              ... on Project {
                spans(
                  first: 100
                  rootSpansOnly: true
                  sort: {col: startTime, dir: desc}
                  timeRange: $timeRange
                  traceFilterCondition: "num_spans > 0"
                ) { edges { node { id } } }
              }
            }
          }
        """,
        variables={
            "id": _project_id(project),
            "timeRange": {
                "start": window_start.isoformat(),
                "end": (window_start + timedelta(hours=1)).isoformat(),
            },
        },
    )

    assert not response.errors
    assert response.data is not None
    assert response.data["node"]["spans"]["edges"] == [
        {"node": {"id": str(GlobalID("Span", str(root.id)))}}
    ]


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
        orphan = await _add_span(session, orphan_trace, attributes={"orphan_only": "included"})
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
        expected_fields = set(grammar.element_bindings.binding_names) | set(grammar.nested)
        expected_fields.update(
            f"{related_name}.{field_name}"
            for related_name, related_bindings in grammar.related.items()
            for field_name in related_bindings.binding_names
        )
        expected_fields.update(grammar.related)
        observed_fields = {term["name"] for term in terms if term["iterableName"] == iterable_name}
        assert observed_fields == expected_fields

    assert terms_by_name['attributes["included.leaf"]']["type"] == "string"
    assert terms_by_name['attributes["orphan_only"]']["type"] == "string"
    parent_span_term = next(
        term for term in terms if term["iterableName"] == "spans" and term["name"] == "parent_span"
    )
    assert parent_span_term["type"] == "boolean"
    assert "no parent row is stored" in parent_span_term["description"]
    assert terms_by_name['annotations["quality"].score']["type"] == "number"
    assert terms_by_name['annotations["quality"].label']["type"] == "string"
    excluded = {
        'attributes["before"]',
        'attributes["child_only"]',
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
