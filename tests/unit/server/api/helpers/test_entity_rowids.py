from collections.abc import Awaitable, Callable, Sequence
from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.entity_rowids import (
    resolve_project_session_rowids,
    resolve_span_rowids,
    resolve_trace_rowids,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

Resolver = Callable[[AsyncSession, Sequence[GlobalID | str]], Awaitable[list[int]]]


@pytest.mark.parametrize(
    "mutation_name, input_type, input_value",
    [
        (
            "createSpanNotes",
            "[CreateSpanNoteInput!]!",
            [{"target": {"otelId": "span"}, "source": "APP", "note": "review"}],
        ),
        (
            "createTraceNotes",
            "[CreateTraceNoteInput!]!",
            [{"target": {"otelId": "trace"}, "source": "APP", "note": "review"}],
        ),
        (
            "createProjectSessionNotes",
            "[CreateProjectSessionNoteInput!]!",
            [{"target": {"sessionId": "session"}, "source": "APP", "note": "review"}],
        ),
        (
            "createProjectSessionAnnotations",
            "CreateProjectSessionAnnotationInput!",
            {
                "projectSessionId": str(GlobalID("ProjectSession", "1")),
                "name": "quality",
                "label": "good",
                "metadata": {},
            },
        ),
        (
            "updateProjectSessionAnnotations",
            "UpdateAnnotationInput!",
            {
                "id": str(GlobalID("ProjectSessionAnnotation", "1")),
                "name": "quality",
                "label": "good",
                "metadata": {},
            },
        ),
    ],
)
@pytest.mark.parametrize(
    "required_field, graphql_type",
    [("annotatorKind", "AnnotatorKind"), ("source", "AnnotationSource")],
)
async def test_annotation_mutations_require_explicit_provenance(
    gql_client: AsyncGraphQLClient,
    caplog: pytest.LogCaptureFixture,
    mutation_name: str,
    input_type: str,
    input_value: dict[str, object] | list[dict[str, object]],
    required_field: str,
    graphql_type: str,
) -> None:
    inputs = input_value if isinstance(input_value, list) else [input_value]
    complete_inputs = [{**value, "annotatorKind": "HUMAN", "source": "APP"} for value in inputs]
    for value in complete_inputs:
        value.pop(required_field)
    result = await gql_client.execute(
        f"""
        mutation Annotate($input: {input_type}) {{
          {mutation_name}(input: $input) {{ __typename }}
        }}
        """,
        {"input": complete_inputs if isinstance(input_value, list) else complete_inputs[0]},
    )

    assert result.data is None
    assert result.errors
    assert (
        f"Field '{required_field}' of required type '{graphql_type}!' was not provided."
        in caplog.text
    )


@pytest.fixture
async def note_targets(
    db: DbSessionFactory,
) -> tuple[list[models.ProjectSession], list[models.Trace], list[models.Span]]:
    async with db() as session:
        project = models.Project(name="note-targets")
        session.add(project)
        await session.flush()

        project_sessions = [
            models.ProjectSession(
                session_id=f"session-{index}",
                project_id=project.id,
                start_time=datetime.now(),
                end_time=datetime.now(),
            )
            for index in range(2)
        ]
        session.add_all(project_sessions)
        await session.flush()

        traces = [
            models.Trace(
                project_rowid=project.id,
                project_session_rowid=project_sessions[index].id,
                trace_id=f"trace-{index}",
                start_time=datetime.now(),
                end_time=datetime.now(),
            )
            for index in range(2)
        ]
        session.add_all(traces)
        await session.flush()

        spans = [
            models.Span(
                trace_rowid=traces[index].id,
                span_id=f"span-{index}",
                name=f"span-{index}",
                span_kind="internal",
                start_time=datetime.now(),
                end_time=datetime.now(),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            for index in range(2)
        ]
        session.add_all(spans)

    return project_sessions, traces, spans


async def test_resolve_span_rowids_preserves_mixed_input_order(
    db: DbSessionFactory,
    note_targets: tuple[list[models.ProjectSession], list[models.Trace], list[models.Span]],
) -> None:
    _, _, spans = note_targets
    refs: list[GlobalID | str] = [
        GlobalID("Span", str(spans[1].id)),
        spans[0].span_id,
        spans[0].span_id,
    ]

    async with db() as session:
        rowids = await resolve_span_rowids(session, refs)

    assert rowids == [spans[1].id, spans[0].id, spans[0].id]


async def test_resolve_trace_rowids_preserves_mixed_input_order(
    db: DbSessionFactory,
    note_targets: tuple[list[models.ProjectSession], list[models.Trace], list[models.Span]],
) -> None:
    _, traces, _ = note_targets
    refs: list[GlobalID | str] = [traces[1].trace_id, GlobalID("Trace", str(traces[0].id))]

    async with db() as session:
        rowids = await resolve_trace_rowids(session, refs)

    assert rowids == [traces[1].id, traces[0].id]


async def test_resolve_project_session_rowids_preserves_mixed_input_order(
    db: DbSessionFactory,
    note_targets: tuple[list[models.ProjectSession], list[models.Trace], list[models.Span]],
) -> None:
    project_sessions, _, _ = note_targets
    refs: list[GlobalID | str] = [
        GlobalID("ProjectSession", str(project_sessions[1].id)),
        project_sessions[0].session_id,
    ]

    async with db() as session:
        rowids = await resolve_project_session_rowids(session, refs)

    assert rowids == [project_sessions[1].id, project_sessions[0].id]


@pytest.mark.parametrize(
    "resolver, entity_name",
    [
        pytest.param(resolve_span_rowids, "spans", id="spans"),
        pytest.param(resolve_trace_rowids, "traces", id="traces"),
        pytest.param(resolve_project_session_rowids, "project sessions", id="sessions"),
    ],
)
async def test_resolve_rowids_lists_every_missing_reference(
    db: DbSessionFactory,
    resolver: Resolver,
    entity_name: str,
) -> None:
    with pytest.raises(
        NotFound,
        match=rf"Could not find {entity_name} with IDs: \['missing-1', 'missing-2'\]",
    ):
        async with db() as session:
            await resolver(session, ["missing-1", "missing-2"])


@pytest.mark.parametrize(
    "resolver, wrong_type",
    [
        pytest.param(resolve_span_rowids, "Trace", id="spans"),
        pytest.param(resolve_trace_rowids, "Span", id="traces"),
        pytest.param(resolve_project_session_rowids, "Trace", id="sessions"),
    ],
)
async def test_resolve_rowids_rejects_global_id_of_wrong_type(
    db: DbSessionFactory,
    resolver: Resolver,
    wrong_type: str,
) -> None:
    ref = GlobalID(wrong_type, "1")

    with pytest.raises(BadRequest, match="instead corresponds to a node of type"):
        async with db() as session:
            await resolver(session, [ref])


@pytest.mark.parametrize(
    "mutation_name, input_type, external_field",
    [
        ("createSpanNotes", "CreateSpanNoteInput", "otelId"),
        ("createTraceNotes", "CreateTraceNoteInput", "otelId"),
        ("createProjectSessionNotes", "CreateProjectSessionNoteInput", "sessionId"),
    ],
)
@pytest.mark.parametrize(
    "invalid_target, expected_error",
    [
        ("empty", "OneOf"),
        ("both", "OneOf"),
        ("null-id", "must be non-null"),
        ("null-external", "must be non-null"),
    ],
)
async def test_note_target_requires_exactly_one_non_null_identifier(
    gql_client: AsyncGraphQLClient,
    mutation_name: str,
    input_type: str,
    external_field: str,
    invalid_target: str,
    expected_error: str,
) -> None:
    targets = {
        "empty": {},
        "both": {"id": str(GlobalID("Span", "1")), external_field: "external-id"},
        "null-id": {"id": None},
        "null-external": {external_field: None},
    }
    result = await gql_client.execute(
        f"""
        mutation CreateNotes($input: [{input_type}!]!) {{
          {mutation_name}(input: $input) {{ __typename }}
        }}
        """,
        {
            "input": [
                {
                    "target": targets[invalid_target],
                    "annotatorKind": "HUMAN",
                    "source": "APP",
                    "note": "review",
                }
            ]
        },
    )

    assert result.data is None
    assert result.errors
    assert any(expected_error in error.message for error in result.errors)


@pytest.mark.parametrize("raw_id_kind", ["session-node-id", "other-node-id", "whitespace"])
async def test_session_note_target_preserves_literal_session_id(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
    note_targets: tuple[list[models.ProjectSession], list[models.Trace], list[models.Span]],
    raw_id_kind: str,
) -> None:
    project_sessions, _, _ = note_targets
    first, second = project_sessions
    raw_id = {
        "session-node-id": str(GlobalID("ProjectSession", str(first.id))),
        "other-node-id": str(GlobalID("Trace", "1")),
        "whitespace": " session with spaces ",
    }[raw_id_kind]
    async with db() as session:
        stored_session = await session.get(models.ProjectSession, second.id)
        assert stored_session is not None
        stored_session.session_id = raw_id

    result = await gql_client.execute(
        """
        mutation CreateNotes($input: [CreateProjectSessionNoteInput!]!) {
          createProjectSessionNotes(input: $input) {
            projectSessionAnnotations { id }
          }
        }
        """,
        {
            "input": [
                {
                    "target": {"sessionId": raw_id},
                    "annotatorKind": "HUMAN",
                    "source": "APP",
                    "note": "raw session",
                },
                {
                    "target": {"id": str(GlobalID("ProjectSession", str(first.id)))},
                    "annotatorKind": "HUMAN",
                    "source": "APP",
                    "note": "node session",
                },
            ]
        },
    )

    assert result.data is not None
    assert not result.errors
    notes = result.data["createProjectSessionNotes"]["projectSessionAnnotations"]
    async with db() as session:
        for note, expected_rowid in zip(notes, [second.id, first.id]):
            stored_note = await session.get(
                models.ProjectSessionAnnotation, int(GlobalID.from_id(note["id"]).node_id)
            )
            assert stored_note is not None
            assert stored_note.project_session_id == expected_rowid
