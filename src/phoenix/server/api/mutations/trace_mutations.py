import strawberry
from sqlalchemy import and_, delete, not_, select, update
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

            await session.execute(
                update(models.Trace)
                .where(models.Trace.id.in_(trace_rowids))
                .values(project_rowid=dest_project_rowid)
            )

        return Query()
