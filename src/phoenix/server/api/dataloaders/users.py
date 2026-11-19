from collections import defaultdict
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import load_only
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

UserId: TypeAlias = int
Key: TypeAlias = UserId
Result: TypeAlias = Optional[models.User]

_USER_PUBLIC_COLUMNS = (
    models.User.id,
    models.User.user_role_id,
    models.User.username,
    models.User.email,
    models.User.profile_picture_url,
    models.User.reset_password,
    models.User.auth_method,
    models.User.created_at,
)


class UsersDataLoader(DataLoader[Key, Result]):
    """DataLoader that batches together users by their ids."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        user_ids = list(set(keys))
        users_by_id: defaultdict[Key, Result] = defaultdict(None)
        async with self._db.read() as session:
            data = await session.stream_scalars(
                select(models.User)
                .options(load_only(*_USER_PUBLIC_COLUMNS))
                .where(models.User.id.in_(user_ids))
            )
            async for user in data:
                users_by_id[user.id] = user

        return [users_by_id.get(user_id) for user_id in keys]
