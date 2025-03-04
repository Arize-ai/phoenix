import strawberry
from sqlalchemy import delete
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.queries import Query
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.dml_event import SpanDeleteEvent


@strawberry.type
class TraceMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_traces(
        self,
        info: Info[Context, None],
        trace_ids: list[GlobalID],
    ) -> Query:
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
                )
            ).all()
            if len(traces) != len(trace_rowids):
                await session.rollback()
                raise BadRequest("Failed to delete all traces")
            project_ids = tuple(set(trace.project_rowid for trace in traces))
            info.context.event_queue.put(SpanDeleteEvent(project_ids))
        return Query()
