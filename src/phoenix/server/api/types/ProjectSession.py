from datetime import datetime
from typing import TYPE_CHECKING, Annotated, ClassVar, Optional, Type

import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import select
from strawberry import UNSET, Info, Private, lazy
from strawberry.relay import Connection, GlobalID, Node, NodeID

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.MimeType import MimeType
from phoenix.server.api.types.pagination import ConnectionArgs, CursorString, connection_from_list
from phoenix.server.api.types.SpanIOValue import SpanIOValue
from phoenix.server.api.types.TokenUsage import TokenUsage

if TYPE_CHECKING:
    from phoenix.server.api.types.Trace import Trace


@strawberry.type
class ProjectSession(Node):
    _table: ClassVar[Type[models.ProjectSession]] = models.ProjectSession
    id_attr: NodeID[int]
    project_rowid: Private[int]
    session_id: str
    start_time: datetime
    end_time: datetime

    @strawberry.field
    async def project_id(self) -> GlobalID:
        from phoenix.server.api.types.Project import Project

        return GlobalID(type_name=Project.__name__, node_id=str(self.project_rowid))

    @strawberry.field
    async def num_traces(
        self,
        info: Info[Context, None],
    ) -> int:
        return await info.context.data_loaders.session_num_traces.load(self.id_attr)

    @strawberry.field
    async def num_traces_with_error(
        self,
        info: Info[Context, None],
    ) -> int:
        return await info.context.data_loaders.session_num_traces_with_error.load(self.id_attr)

    @strawberry.field
    async def first_input(
        self,
        info: Info[Context, None],
    ) -> Optional[SpanIOValue]:
        record = await info.context.data_loaders.session_first_inputs.load(self.id_attr)
        if record is None:
            return None
        return SpanIOValue(
            mime_type=MimeType(record.mime_type.value),
            value=record.value,
        )

    @strawberry.field
    async def last_output(
        self,
        info: Info[Context, None],
    ) -> Optional[SpanIOValue]:
        record = await info.context.data_loaders.session_last_outputs.load(self.id_attr)
        if record is None:
            return None
        return SpanIOValue(
            mime_type=MimeType(record.mime_type.value),
            value=record.value,
        )

    @strawberry.field
    async def token_usage(
        self,
        info: Info[Context, None],
    ) -> TokenUsage:
        usage = await info.context.data_loaders.session_token_usages.load(self.id_attr)
        return TokenUsage(
            prompt=usage.prompt,
            completion=usage.completion,
        )

    @strawberry.field
    async def traces(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[Annotated["Trace", lazy(".Trace")]]:
        from phoenix.server.api.types.Trace import to_gql_trace

        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        stmt = (
            select(models.Trace)
            .filter_by(project_session_rowid=self.id_attr)
            .order_by(models.Trace.start_time)
            .limit(first)
        )
        async with info.context.db() as session:
            traces = await session.stream_scalars(stmt)
            data = [to_gql_trace(trace) async for trace in traces]
        return connection_from_list(data=data, args=args)

    @strawberry.field
    async def trace_latency_ms_quantile(
        self,
        info: Info[Context, None],
        probability: float,
    ) -> Optional[float]:
        return await info.context.data_loaders.session_trace_latency_ms_quantile.load(
            (self.id_attr, probability)
        )


def to_gql_project_session(project_session: models.ProjectSession) -> ProjectSession:
    return ProjectSession(
        id_attr=project_session.id,
        session_id=project_session.session_id,
        start_time=project_session.start_time,
        project_rowid=project_session.project_id,
        end_time=project_session.end_time,
    )


INPUT_VALUE = SpanAttributes.INPUT_VALUE.split(".")
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE.split(".")
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE.split(".")
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE.split(".")
