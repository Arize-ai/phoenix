from typing import Optional

import strawberry
from sqlalchemy import desc, select
from strawberry import UNSET, Info
from strawberry.relay import Connection, Node, NodeID

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.pagination import ConnectionArgs, CursorString, connection_from_list
from phoenix.server.api.types.Trace import Trace, to_gql_trace


@strawberry.type
class ProjectSession(Node):
    id_attr: NodeID[int]
    session_id: str

    @strawberry.field
    async def traces(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[Trace]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        stmt = (
            select(models.Trace)
            .filter_by(project_session_id=self.id_attr)
            .order_by(desc(models.Trace.id))
            .limit(first)
        )
        async with info.context.db() as session:
            traces = await session.stream_scalars(stmt)
            data = [to_gql_trace(trace) async for trace in traces]
        return connection_from_list(data=data, args=args)


def to_gql_project_session(
    project_session: models.ProjectSession,
) -> ProjectSession:
    return ProjectSession(
        id_attr=project_session.id,
        session_id=project_session.session_id,
    )
