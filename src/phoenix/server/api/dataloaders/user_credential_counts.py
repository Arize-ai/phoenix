from dataclasses import dataclass
from typing import Iterable

from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

UserId: TypeAlias = int
Key: TypeAlias = UserId


@dataclass(frozen=True)
class UserCredentialCounts:
    api_key_count: int = 0
    oauth2_grant_count: int = 0


Result: TypeAlias = UserCredentialCounts


class UserCredentialCountsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        user_ids = list(set(keys))
        api_key_counts: dict[UserId, int] = {}
        oauth2_grant_counts: dict[UserId, int] = {}
        async with self._db.read() as session:
            api_key_rows = await session.stream(
                select(models.ApiKey.user_id, func.count())
                .where(models.ApiKey.user_id.in_(user_ids))
                .group_by(models.ApiKey.user_id)
            )
            async for user_id, count in api_key_rows:
                api_key_counts[user_id] = count

            oauth2_grant_rows = await session.stream(
                select(models.OAuth2Grant.user_id, func.count())
                .where(models.OAuth2Grant.user_id.in_(user_ids))
                .where(models.OAuth2Grant.revoked_at.is_(None))
                .group_by(models.OAuth2Grant.user_id)
            )
            async for user_id, count in oauth2_grant_rows:
                oauth2_grant_counts[user_id] = count

        return [
            UserCredentialCounts(
                api_key_count=api_key_counts.get(user_id, 0),
                oauth2_grant_count=oauth2_grant_counts.get(user_id, 0),
            )
            for user_id in keys
        ]
