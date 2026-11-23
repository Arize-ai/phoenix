import strawberry
from sqlalchemy import and_, delete, exists, not_, select, update
from sqlalchemy.sql import literal
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, delete_traces
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
                await session.execute(
                    select(models.Trace.project_rowid, models.Trace.project_session_rowid)
                    .join(models.Project, models.Trace.project_rowid == models.Project.id)
                    .where(
                        models.Trace.id.in_(trace_rowids),
                        models.Project.deleted_at.is_(None),
                    )
                )
            ).all()
            if len(traces) < len(trace_rowids):
                raise BadRequest("Invalid trace IDs provided")
            project_ids = tuple(set(project_rowid for project_rowid, _ in traces))
            if len(project_ids) > 1:
                raise BadRequest("Cannot delete traces from multiple projects")
            session_ids = set(session_id for _, session_id in traces if session_id is not None)
            await delete_traces(
                session,
                and_(
                    models.Trace.id.in_(trace_rowids),
                    exists().where(
                        models.Project.id == models.Trace.project_rowid,
                        models.Project.deleted_at.is_(None),
                    ),
                ),
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

        dialect = SupportedSQLDialect(info.context.db.dialect.value)
        async with info.context.db() as session:
            dest_project = await session.get(models.Project, dest_project_rowid)
            if dest_project is None or dest_project.deleted_at is not None:
                raise BadRequest("Destination project does not exist")
            if dest_project.kind in ("EVALUATOR", "EXPERIMENT"):
                raise BadRequest(
                    "Cannot transfer traces into an evaluator or experiment trace project"
                )

            traces = (
                await session.scalars(select(models.Trace).where(models.Trace.id.in_(trace_rowids)))
            ).all()
            if len(traces) < len(trace_rowids):
                raise BadRequest("Invalid trace IDs provided")

            source_project_ids = set(trace.project_rowid for trace in traces)
            if await session.scalar(
                select(
                    exists().where(
                        models.Project.id.in_(source_project_ids),
                        models.Project.deleted_at.is_not(None),
                    )
                )
            ):
                raise BadRequest("Invalid trace IDs provided")
            if len(source_project_ids) > 1:
                raise BadRequest("Cannot transfer traces from multiple projects")
            if any(trace.project_session_rowid is not None for trace in traces):
                raise BadRequest(
                    "Cannot transfer traces attached to a session; remove the session "
                    "association before transferring them"
                )

            involved_project_ids = sorted({*source_project_ids, dest_project_rowid})
            live_projects_stmt = (
                select(models.Project.id, models.Project.kind)
                .where(
                    models.Project.id.in_(involved_project_ids),
                    models.Project.deleted_at.is_(None),
                )
                .order_by(models.Project.id.asc())
            )
            if dialect is SupportedSQLDialect.POSTGRESQL:
                live_projects_stmt = live_projects_stmt.with_for_update(read=True)
            live_projects = {
                int(row.id): row.kind for row in (await session.execute(live_projects_stmt)).all()
            }
            if dest_project_rowid not in live_projects:
                raise BadRequest("Destination project does not exist")
            if live_projects[dest_project_rowid] in ("EVALUATOR", "EXPERIMENT"):
                raise BadRequest(
                    "Cannot transfer traces into an evaluator or experiment trace project"
                )
            if not (source_project_ids <= set(live_projects)):
                raise BadRequest("Invalid trace IDs provided")

            await session.execute(
                update(models.Trace)
                .where(
                    models.Trace.id.in_(trace_rowids),
                    models.Trace.project_rowid.in_(source_project_ids),
                )
                .values(project_rowid=dest_project_rowid)
            )

        return Query()
