from typing import AsyncContextManager, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db.helpers import SupportedSQLDialect


class DbSessionFactory:
    def __init__(
        self,
        db: Callable[[], AsyncContextManager[AsyncSession]],
        dialect: str,
    ):
        self._db = db
        self.dialect = SupportedSQLDialect(dialect)

    def __call__(self) -> AsyncContextManager[AsyncSession]:
        return self._db()
