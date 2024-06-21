from typing import (
    AsyncContextManager,
    Callable,
    List,
    Optional,
)

from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

ExperimentID: TypeAlias = int
ErrorRate: TypeAlias = float
Key: TypeAlias = ExperimentID
Result: TypeAlias = Optional[ErrorRate]


class ExperimentErrorRatesDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: Callable[[], AsyncContextManager[AsyncSession]],
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        raise NotImplementedError("ExperimentErrorRateDataLoader not implemented yet")
