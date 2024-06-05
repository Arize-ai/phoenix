from typing import (
    AsyncContextManager,
    Callable,
    List,
    Optional,
)

from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.server.api.types.Span import Span

ExampleID: TypeAlias = int
Key: TypeAlias = ExampleID
Result: TypeAlias = Optional[Span]


class DatasetExampleSpansDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        raise NotImplementedError("DatasetExampleSpansDataLoader load function not implemented")
