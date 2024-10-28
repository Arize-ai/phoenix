from datetime import datetime
from typing import TYPE_CHECKING, Annotated, ClassVar, Optional, Type

import strawberry
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import func, select
from sqlalchemy.sql.functions import coalesce
from strawberry import UNSET, Info, lazy
from strawberry.relay import Connection, Node, NodeID

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
    session_id: str
    session_user: Optional[str]
    start_time: datetime
    end_time: datetime

    @strawberry.field(description="Duration of the session in seconds")
    async def duration(
        self,
        info: Info[Context, None],
    ) -> int:
        return int((self.end_time - self.start_time).total_seconds())

    @strawberry.field
    async def num_traces(
        self,
        info: Info[Context, None],
    ) -> int:
        stmt = select(func.count(models.Trace.id)).filter_by(project_session_rowid=self.id_attr)
        async with info.context.db() as session:
            return await session.scalar(stmt) or 0

    @strawberry.field
    async def first_input(
        self,
        info: Info[Context, None],
    ) -> Optional[SpanIOValue]:
        stmt = (
            select(
                models.Span.attributes[INPUT_VALUE].label("value"),
                models.Span.attributes[INPUT_MIME_TYPE].label("mime_type"),
            )
            .join(models.Trace)
            .filter_by(project_session_rowid=self.id_attr)
            .where(models.Span.parent_id.is_(None))
            .order_by(models.Trace.start_time.asc())
            .limit(1)
        )
        async with info.context.db() as session:
            record = (await session.execute(stmt)).first()
        if record is None or record.value is None:
            return None
        return SpanIOValue(
            mime_type=MimeType(record.mime_type),
            value=record.value,
        )

    @strawberry.field
    async def last_output(
        self,
        info: Info[Context, None],
    ) -> Optional[SpanIOValue]:
        stmt = (
            select(
                models.Span.attributes[OUTPUT_VALUE].label("value"),
                models.Span.attributes[OUTPUT_MIME_TYPE].label("mime_type"),
            )
            .join(models.Trace)
            .filter_by(project_session_rowid=self.id_attr)
            .where(models.Span.parent_id.is_(None))
            .order_by(models.Trace.start_time.desc())
            .limit(1)
        )
        async with info.context.db() as session:
            record = (await session.execute(stmt)).first()
        if record is None or record.value is None:
            return None
        return SpanIOValue(
            mime_type=MimeType(record.mime_type),
            value=record.value,
        )

    @strawberry.field
    async def token_usage(
        self,
        info: Info[Context, None],
    ) -> TokenUsage:
        stmt = (
            select(
                func.sum(coalesce(models.Span.cumulative_llm_token_count_prompt, 0)).label(
                    "prompt"
                ),
                func.sum(coalesce(models.Span.cumulative_llm_token_count_completion, 0)).label(
                    "completion"
                ),
            )
            .join(models.Trace)
            .filter_by(project_session_rowid=self.id_attr)
            .where(models.Span.parent_id.is_(None))
            .limit(1)
        )
        async with info.context.db() as session:
            usage = (await session.execute(stmt)).first()
        return (
            TokenUsage(
                prompt=usage.prompt or 0,
                completion=usage.completion or 0,
            )
            if usage
            else TokenUsage()
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


def to_gql_project_session(project_session: models.ProjectSession) -> ProjectSession:
    return ProjectSession(
        id_attr=project_session.id,
        session_id=project_session.session_id,
        session_user=project_session.session_user,
        start_time=project_session.start_time,
        end_time=project_session.end_time,
    )


INPUT_VALUE = SpanAttributes.INPUT_VALUE.split(".")
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE.split(".")
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE.split(".")
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE.split(".")
