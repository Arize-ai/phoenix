from collections import defaultdict

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ModelId: TypeAlias = int
Key: TypeAlias = ModelId
Result: TypeAlias = list[models.TokenPrice]


class TokenPricesByModelDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        model_ids = keys
        token_prices: defaultdict[Key, Result] = defaultdict(list)

        async with self._db() as session:
            async for token_price in await session.stream_scalars(
                select(models.TokenPrice).where(models.TokenPrice.model_id.in_(model_ids))
            ):
                token_prices[token_price.model_id].append(token_price)

        return [token_prices[model_id] for model_id in keys]
