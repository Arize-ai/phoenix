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

Resolver = Callable[[AsyncSession, Sequence[str]], Awaitable[list[int]]]


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
    refs = [str(GlobalID("Span", str(spans[1].id))), spans[0].span_id, spans[0].span_id]

    async with db() as session:
        rowids = await resolve_span_rowids(session, refs)

    assert rowids == [spans[1].id, spans[0].id, spans[0].id]


async def test_resolve_trace_rowids_preserves_mixed_input_order(
    db: DbSessionFactory,
    note_targets: tuple[list[models.ProjectSession], list[models.Trace], list[models.Span]],
) -> None:
    _, traces, _ = note_targets
    refs = [traces[1].trace_id, str(GlobalID("Trace", str(traces[0].id)))]

    async with db() as session:
        rowids = await resolve_trace_rowids(session, refs)

    assert rowids == [traces[1].id, traces[0].id]


async def test_resolve_project_session_rowids_preserves_mixed_input_order(
    db: DbSessionFactory,
    note_targets: tuple[list[models.ProjectSession], list[models.Trace], list[models.Span]],
) -> None:
    project_sessions, _, _ = note_targets
    refs = [
        str(GlobalID("ProjectSession", str(project_sessions[1].id))),
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
    ref = str(GlobalID(wrong_type, "1"))

    with pytest.raises(BadRequest, match="instead corresponds to a node of type"):
        async with db() as session:
            await resolver(session, [ref])
