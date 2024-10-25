from typing import TYPE_CHECKING, Annotated, ClassVar, Optional, Type, cast

import strawberry
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload
from sqlalchemy.sql.functions import coalesce
from strawberry import Info, lazy
from strawberry.relay import Connection, Node, NodeID

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.ChatMessage import ChatMessage, to_gql_chat_message
from phoenix.server.api.types.pagination import ConnectionArgs, connection_from_list
from phoenix.server.api.types.TimeInterval import TimeInterval
from phoenix.server.api.types.TokenUsage import TokenUsage

if TYPE_CHECKING:
    from phoenix.server.api.types.Span import Span
    from phoenix.server.api.types.Trace import Trace


@strawberry.type
class ChatSession(Node):
    _table: ClassVar[Type[models.ChatSessionSpan]] = models.ChatSessionSpan
    id_attr: NodeID[str]

    @strawberry.field
    async def session_id(self) -> str:
        return self.id_attr

    @strawberry.field
    async def session_user(
        self,
        info: Info,
    ) -> Optional[str]:
        stmt = (
            select(self._table.session_user)
            .filter_by(session_id=self.id_attr)
            .order_by(self._table.timestamp.desc())
            .limit(1)
        )
        async with info.context.db() as session:
            session_user = await session.scalar(stmt)
        return cast(Optional[str], session_user)

    @strawberry.field
    async def time_interval(
        self,
        info: Info,
    ) -> TimeInterval:
        stmt = (
            select(
                func.min(models.Trace.start_time),
                func.max(models.Trace.end_time),
            )
            .join_from(self._table, models.Trace)
            .group_by(self._table.session_id)
            .where(self._table.session_id == self.id_attr)
            .limit(1)
        )
        async with info.context.db() as session:
            record = (await session.execute(stmt)).first()
        assert record is not None
        start, end = record
        return TimeInterval(start=start, end=end)

    @strawberry.field
    async def num_spans(
        self,
        info: Info[Context, None],
    ) -> int:
        stmt = select(func.count(self._table.id)).filter_by(session_id=self.id_attr)
        async with info.context.db() as session:
            return await session.scalar(stmt) or 0

    @strawberry.field
    async def first_input_message(
        self,
        info: Info[Context, None],
    ) -> Optional[ChatMessage]:
        first = (
            select(
                self._table.span_rowid,
                func.row_number()
                .over(
                    partition_by=self._table.session_id,
                    order_by=self._table.timestamp.asc(),
                )
                .label("rank"),
            )
            .filter_by(session_id=self.id_attr)
            .cte()
        )
        stmt = (
            select(models.Span.last_input_message)
            .join_from(first, models.Span)
            .where(first.c.rank == 1)
            .limit(1)
        )
        async with info.context.db() as session:
            message = await session.scalar(stmt)
        return to_gql_chat_message(message)

    @strawberry.field
    async def last_output_message(
        self,
        info: Info[Context, None],
    ) -> Optional[ChatMessage]:
        last = (
            select(
                self._table.span_rowid,
                func.row_number()
                .over(
                    partition_by=self._table.session_id,
                    order_by=self._table.timestamp.desc(),
                )
                .label("rank"),
            )
            .filter_by(session_id=self.id_attr)
            .cte()
        )
        stmt = (
            select(models.Span.first_output_message)
            .join_from(last, models.Span)
            .where(last.c.rank == 1)
            .limit(1)
        )
        async with info.context.db() as session:
            message = await session.scalar(stmt)
        return to_gql_chat_message(message)

    @strawberry.field
    async def token_usage(self, info: Info[Context, None]) -> TokenUsage:
        stmt = (
            select(
                func.sum(coalesce(models.Span.llm_token_count_prompt, 0)).label("prompt"),
                func.sum(coalesce(models.Span.llm_token_count_completion, 0)).label("completion"),
            )
            .join(self._table)
            .filter_by(session_id=self.id_attr)
        )
        async with info.context.db() as session:
            usage = (await session.execute(stmt)).first()
        return (
            TokenUsage(
                prompt=usage.prompt,
                completion=usage.completion,
            )
            if usage
            else TokenUsage()
        )

    @strawberry.field
    async def spans(
        self,
        info: Info[Context, None],
    ) -> Connection[Annotated["Span", lazy(".Span")]]:
        from phoenix.server.api.types.Span import to_gql_span

        stmt = (
            select(models.Span)
            .join_from(models.Span, self._table)
            .filter_by(session_id=self.id_attr)
            .order_by(self._table.timestamp)
            .options(joinedload(models.Span.trace).load_only(models.Trace.trace_id))
        )
        async with info.context.db() as session:
            spans = await session.stream_scalars(stmt)
            data = [to_gql_span(span) async for span in spans]
        return connection_from_list(data=data, args=ConnectionArgs())

    @strawberry.field
    async def traces(
        self,
        info: Info[Context, None],
    ) -> Connection[Annotated["Trace", lazy(".Trace")]]:
        from phoenix.server.api.types.Trace import Trace

        stmt = (
            select(models.Trace)
            .join_from(models.Trace, self._table)
            .filter_by(session_id=self.id_attr)
            .order_by(models.Trace.start_time)
        )
        async with info.context.db() as session:
            traces = await session.stream_scalars(stmt)
            data = [
                Trace(
                    id_attr=trace.id,
                    trace_id=trace.trace_id,
                    project_rowid=trace.project_rowid,
                )
                async for trace in traces
            ]
        return connection_from_list(data=data, args=ConnectionArgs())
