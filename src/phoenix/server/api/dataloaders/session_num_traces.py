from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.session_aggregates import num_traces_by_session
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = int


class SessionNumTracesDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        stmt = num_traces_by_session().as_grouped_subquery(keys)
        async with self._db.read() as session:
            result: dict[Key, int] = {
                id_: value async for id_, value in await session.stream(stmt) if id_ is not None
            }
        return [result.get(key, 0) for key in keys]
