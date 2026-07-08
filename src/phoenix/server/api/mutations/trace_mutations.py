import strawberry
from sqlalchemy import and_, delete, not_, select
from sqlalchemy.orm import load_only
from sqlalchemy.sql import literal
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.dml_event import SpanDeleteEvent


@strawberry.type
class TraceMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_traces(
        self,
        info: Info[Context, None],
        trace_ids: list[GlobalID],
    ) -> Query:
        if not trace_ids:
            raise BadRequest("Must provide at least one trace ID to delete")
        trace_ids = list(set(trace_ids))
        try:
            trace_rowids = [
                from_global_id_with_expected_type(global_id=id, expected_type_name="Trace")
                for id in trace_ids
            ]
        except ValueError as error:
            raise BadRequest(str(error))
        async with info.context.db() as session:
            traces = (
                await session.scalars(
                    delete(models.Trace)
                    .where(models.Trace.id.in_(trace_rowids))
                    .returning(models.Trace)
                    .options(
                        load_only(models.Trace.project_rowid, models.Trace.project_session_rowid)
                    )
                )
            ).all()
            if len(traces) < len(trace_rowids):
                await session.rollback()
                raise BadRequest("Invalid trace IDs provided")
            project_ids = tuple(set(trace.project_rowid for trace in traces))
            if len(project_ids) > 1:
                await session.rollback()
                raise BadRequest("Cannot delete traces from multiple projects")
            session_ids = set(
                session_id
                for trace in traces
                if (session_id := trace.project_session_rowid) is not None
            )
            if session_ids:
                await session.execute(
                    delete(models.ProjectSession).where(
                        and_(
                            models.ProjectSession.id.in_(session_ids),
                            not_(
                                select(literal(1))
                                .where(
                                    models.Trace.project_session_rowid == models.ProjectSession.id
                                )
                                .exists()
                            ),
                        )
                    )
                )
            info.context.event_queue.put(SpanDeleteEvent(project_ids))
        return Query()

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def transfer_traces_to_project(
        self,
        info: Info[Context, None],
        trace_ids: list[GlobalID],
        project_id: GlobalID,
    ) -> Query:
        if not trace_ids:
            raise BadRequest("Must provide at least one trace ID to transfer")
        trace_ids = list(set(trace_ids))
        try:
            trace_rowids = [
                from_global_id_with_expected_type(global_id=id, expected_type_name="Trace")
                for id in trace_ids
            ]
            dest_project_rowid = from_global_id_with_expected_type(
                global_id=project_id, expected_type_name="Project"
            )
        except ValueError as error:
            raise BadRequest(str(error))

        async with info.context.db() as session:
            dest_project = await session.get(models.Project, dest_project_rowid)
            if dest_project is None:
                raise BadRequest("Destination project does not exist")

            traces = (
                await session.scalars(select(models.Trace).where(models.Trace.id.in_(trace_rowids)))
            ).all()
            if len(traces) < len(trace_rowids):
                raise BadRequest("Invalid trace IDs provided")

            source_project_ids = set(trace.project_rowid for trace in traces)
            if len(source_project_ids) > 1:
                raise BadRequest("Cannot transfer traces from multiple projects")

            # The source sessions the moved traces belong to — remembered so any left without
            # traces can be swept after the move.
            source_session_rowids = {
                trace.project_session_rowid
                for trace in traces
                if trace.project_session_rowid is not None
            }
            # A session_id is unique only within a project, so a moved trace cannot keep its
            # link to the source project's session. Resolve each trace's session_id in the
            # destination: join the destination's session of that id (creating it if absent),
            # never the source's.
            session_id_by_rowid: dict[int, str] = {}
            if source_session_rowids:
                session_id_by_rowid = {
                    rowid: session_id
                    for rowid, session_id in await session.execute(
                        select(models.ProjectSession.id, models.ProjectSession.session_id).where(
                            models.ProjectSession.id.in_(source_session_rowids)
                        )
                    )
                }
            dest_session_by_session_id: dict[str, models.ProjectSession] = {}
            for trace in traces:
                trace.project_rowid = dest_project_rowid
                if trace.project_session_rowid is None:
                    continue
                session_id = session_id_by_rowid.get(trace.project_session_rowid)
                if session_id is None:
                    trace.project_session_rowid = None
                    continue
                dest_session = dest_session_by_session_id.get(session_id)
                if dest_session is None:
                    dest_session = await session.scalar(
                        select(models.ProjectSession).filter_by(
                            project_id=dest_project_rowid, session_id=session_id
                        )
                    )
                    if dest_session is None:
                        dest_session = models.ProjectSession(
                            project_id=dest_project_rowid,
                            session_id=session_id,
                            start_time=trace.start_time,
                            end_time=trace.end_time,
                        )
                        session.add(dest_session)
                        await session.flush()
                    dest_session_by_session_id[session_id] = dest_session
                # Widen the destination session's window to cover the moved trace.
                if trace.start_time < dest_session.start_time:
                    dest_session.start_time = trace.start_time
                if dest_session.end_time < trace.end_time:
                    dest_session.end_time = trace.end_time
                trace.project_session_rowid = dest_session.id
            await session.flush()

            # Sweep source sessions left with no traces — including the just-vacated ones, and
            # before their (project_id, session_id) could be reused.
            if source_session_rowids:
                still_referenced = set(
                    await session.scalars(
                        select(models.Trace.project_session_rowid)
                        .where(models.Trace.project_session_rowid.in_(source_session_rowids))
                        .distinct()
                    )
                )
                if orphaned := source_session_rowids - still_referenced:
                    await session.execute(
                        delete(models.ProjectSession).where(models.ProjectSession.id.in_(orphaned))
                    )

        return Query()
