from datetime import datetime, timezone
from secrets import token_hex

from sqlalchemy import select

from phoenix.db import models
from phoenix.db.insertion.span import insert_span
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanKind,
    SpanStatusCode,
)


def _make_span(session_id: str) -> Span:
    now = datetime.now(timezone.utc)
    return Span(
        name="root",
        context=SpanContext(trace_id=token_hex(16), span_id=token_hex(8)),
        span_kind=SpanKind.CHAIN,
        parent_id=None,
        start_time=now,
        end_time=now,
        status_code=SpanStatusCode.OK,
        status_message="",
        # Attributes are stored un-flattened (nested), so "session.id" lives at
        # attributes["session"]["id"].
        attributes={"session": {"id": session_id}},
        events=[],
        conversation=None,
    )


class TestSessionIdIsScopedToProject:
    async def test_same_session_id_in_two_projects_yields_distinct_sessions(
        self,
        db: DbSessionFactory,
    ) -> None:
        # Two projects each ingest a span carrying session_id "default" — the most
        # common collision. Before the fix, the second project's trace attached to
        # the first project's session (a cross-project write).
        async with db() as session:
            await insert_span(session, _make_span("default"), project_name="project-a")
            await insert_span(session, _make_span("default"), project_name="project-b")

        async with db() as session:
            project_sessions = (
                await session.scalars(
                    select(models.ProjectSession).where(
                        models.ProjectSession.session_id == "default"
                    )
                )
            ).all()
            projects = {p.id: p.name for p in (await session.scalars(select(models.Project))).all()}

        # One ProjectSession row per project, not a single shared row.
        assert len(project_sessions) == 2
        owning_projects = {projects[ps.project_id] for ps in project_sessions}
        assert owning_projects == {"project-a", "project-b"}

    async def test_same_session_id_same_project_reuses_session(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            await insert_span(session, _make_span("default"), project_name="project-a")
            await insert_span(session, _make_span("default"), project_name="project-a")

        async with db() as session:
            project_sessions = (
                await session.scalars(
                    select(models.ProjectSession).where(
                        models.ProjectSession.session_id == "default"
                    )
                )
            ).all()
            traces = (await session.scalars(select(models.Trace))).all()

        # Same project + same session_id reuses the one session; both traces hang off it.
        assert len(project_sessions) == 1
        assert {t.project_session_rowid for t in traces} == {project_sessions[0].id}
