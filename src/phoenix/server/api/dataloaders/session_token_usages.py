from sqlalchemy import func, select
from sqlalchemy.sql.functions import coalesce
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import TokenUsage

Key: TypeAlias = int
Result: TypeAlias = TokenUsage


class SessionTokenUsagesDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        stmt = (
            select(
                models.Trace.project_session_rowid.label("id_"),
                func.sum(coalesce(models.Span.cumulative_llm_token_count_prompt, 0)).label(
                    "prompt"
                ),
                func.sum(coalesce(models.Span.cumulative_llm_token_count_completion, 0)).label(
                    "completion"
                ),
            )
            .join_from(models.Span, models.Trace)
            .where(models.Span.parent_id.is_(None))
            .where(models.Trace.project_session_rowid.in_(keys))
            .group_by(models.Trace.project_session_rowid)
        )
        async with self._db() as session:
            result: dict[Key, TokenUsage] = {
                id_: TokenUsage(prompt=prompt, completion=completion)
                async for id_, prompt, completion in await session.stream(stmt)
                if id_ is not None
            }
        return [result.get(key, TokenUsage()) for key in keys]
