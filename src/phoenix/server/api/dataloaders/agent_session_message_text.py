from functools import cached_property
from typing import Literal, Optional, cast

from sqlalchemy import Select, func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.db.types.data_stream_protocol.request_types import TextUIPart
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = Optional[str]
Kind = Literal["first_input", "latest_output"]


class AgentSessionMessageTextDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory, kind: Kind) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db
        self._kind = kind

    @cached_property
    def _subquery(self) -> Select[tuple[int, PhoenixUIMessage, int]]:
        message = models.AgentSessionMessage
        statement = select(
            message.agent_session_id.label("agent_session_id"),
            message.message.label("message"),
        )
        if self._kind == "first_input":
            statement = statement.where(
                message.message["role"].as_string() == "user",
                message.is_compaction_message.is_(False),
            ).add_columns(
                func.row_number()
                .over(
                    partition_by=message.agent_session_id,
                    order_by=message.position.asc(),
                )
                .label("rank")
            )
        elif self._kind == "latest_output":
            statement = statement.where(
                message.message["role"].as_string() == "assistant"
            ).add_columns(
                func.row_number()
                .over(
                    partition_by=message.agent_session_id,
                    order_by=message.position.desc(),
                )
                .label("rank")
            )
        else:
            assert_never(self._kind)
        return cast(Select[tuple[int, PhoenixUIMessage, int]], statement)

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        subquery = self._subquery.where(
            models.AgentSessionMessage.agent_session_id.in_(keys)
        ).subquery()
        statement = select(
            subquery.c.agent_session_id,
            subquery.c.message,
        ).where(subquery.c.rank == 1)
        async with self._db.read() as session:
            messages = {
                agent_session_id: message
                async for agent_session_id, message in await session.stream(statement)
            }
        return [_get_message_text(messages.get(key)) for key in keys]


def _get_message_text(message: Optional[PhoenixUIMessage]) -> Optional[str]:
    if message is None:
        return None
    text = "\n".join(part.text for part in message.parts if isinstance(part, TextUIPart))
    return text or None
