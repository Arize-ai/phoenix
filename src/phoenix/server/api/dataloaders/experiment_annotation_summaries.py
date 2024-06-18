from dataclasses import dataclass
from typing import (
    AsyncContextManager,
    Callable,
    List,
    Optional,
)

from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias


@dataclass
class ExperimentAnnotationSummary:
    annotation_name: str
    mean_score: float


ExperimentID: TypeAlias = int
Key: TypeAlias = ExperimentID
Result: TypeAlias = List[ExperimentAnnotationSummary]


class ExperimentAnnotationSummaryDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: Callable[[], AsyncContextManager[AsyncSession]],
        cache_map: Optional[AbstractCache[Key, Result]] = None,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        raise NotImplementedError(
            "ExperimentAnnotationSummariesDataLoader._load_fn not implemented yet"
        )
