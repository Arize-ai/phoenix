from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.session_aggregates import SESSION_ROWID, token_counts_by_session
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import TokenUsage

Key: TypeAlias = int
Result: TypeAlias = TokenUsage


class SessionTokenUsagesDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        stmt = token_counts_by_session().as_grouped_subquery(keys)
        async with self._db.read() as session:
            result: dict[Key, TokenUsage] = {
                row._mapping[SESSION_ROWID]: TokenUsage(
                    prompt=row.prompt, completion=row.completion
                )
                async for row in await session.stream(stmt)
                if row._mapping[SESSION_ROWID] is not None
            }
        return [result.get(key, TokenUsage()) for key in keys]
