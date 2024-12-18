from functools import cached_property
from typing import Literal, Optional, cast

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import Select, func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import MimeType, SpanIOValue

Key: TypeAlias = int
Result: TypeAlias = Optional[SpanIOValue]

Kind = Literal["first_input", "last_output"]


class SessionIODataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory, kind: Kind) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db
        self._kind = kind

    @cached_property
    def _subq(self) -> Select[tuple[Optional[int], str, str, int]]:
        stmt = (
            select(models.Trace.project_session_rowid.label("id_"))
            .join_from(models.Span, models.Trace)
            .where(models.Span.parent_id.is_(None))
        )
        if self._kind == "first_input":
            stmt = stmt.add_columns(
                models.Span.attributes[INPUT_VALUE].as_string().label("value"),
                models.Span.attributes[INPUT_MIME_TYPE].as_string().label("mime_type"),
                func.row_number()
                .over(
                    partition_by=models.Trace.project_session_rowid,
                    order_by=[models.Trace.start_time.asc(), models.Trace.id.asc()],
                )
                .label("rank"),
            )
        elif self._kind == "last_output":
            stmt = stmt.add_columns(
                models.Span.attributes[OUTPUT_VALUE].as_string().label("value"),
                models.Span.attributes[OUTPUT_MIME_TYPE].as_string().label("mime_type"),
                func.row_number()
                .over(
                    partition_by=models.Trace.project_session_rowid,
                    order_by=[models.Trace.start_time.desc(), models.Trace.id.desc()],
                )
                .label("rank"),
            )
        else:
            assert_never(self._kind)
        return cast(Select[tuple[Optional[int], str, str, int]], stmt)

    def _stmt(self, *keys: Key) -> Select[tuple[int, str, str]]:
        subq = self._subq.where(models.Trace.project_session_rowid.in_(keys)).subquery()
        return (
            select(subq.c.id_, subq.c.value, subq.c.mime_type)
            .filter_by(rank=1)
            .where(subq.c.value.isnot(None))
        )

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        async with self._db() as session:
            result: dict[Key, SpanIOValue] = {
                id_: SpanIOValue(value=value, mime_type=MimeType(mime_type))
                async for id_, value, mime_type in await session.stream(self._stmt(*keys))
                if id_ is not None
            }
        return [result.get(key) for key in keys]


INPUT_VALUE = SpanAttributes.INPUT_VALUE.split(".")
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE.split(".")
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE.split(".")
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE.split(".")
