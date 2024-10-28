from collections import defaultdict
from typing import Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

UserRoleId: TypeAlias = int
Key: TypeAlias = UserRoleId
Result: TypeAlias = Optional[models.UserRole]


class UserRolesDataLoader(DataLoader[Key, Result]):
    """DataLoader that batches together user roles by their ids."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        user_roles_by_id: defaultdict[Key, Result] = defaultdict(None)
        async with self._db() as session:
            data = await session.stream_scalars(select(models.UserRole))
            async for user_role in data:
                user_roles_by_id[user_role.id] = user_role

        return [user_roles_by_id.get(role_id) for role_id in keys]
