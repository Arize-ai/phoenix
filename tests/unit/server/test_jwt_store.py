from typing import Any

import pytest
from pydantic import SecretStr
from sqlalchemy.dialects import mysql

from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.jwt_store import JwtStore
from phoenix.server.types import UserId


class _ScalarResult:
    def __init__(self, values: list[int]) -> None:
        self._values = values

    def all(self) -> list[int]:
        return self._values


class _Session:
    def __init__(self) -> None:
        self.statements: list[Any] = []

    async def __aenter__(self) -> "_Session":
        return self

    async def __aexit__(self, *args: Any) -> None:
        return None

    async def scalars(self, stmt: Any) -> _ScalarResult:
        self.statements.append(stmt)
        return _ScalarResult([1])

    async def execute(self, stmt: Any) -> None:
        self.statements.append(stmt)


class _Db:
    dialect = SupportedSQLDialect.MYSQL

    def __init__(self) -> None:
        self.session = _Session()

    def __call__(self) -> _Session:
        return self.session


def _compile_mysql(stmt: Any) -> str:
    return str(stmt.compile(dialect=mysql.dialect(), compile_kwargs={"literal_binds": True}))


@pytest.mark.asyncio
async def test_log_out_avoids_returning_for_mysql() -> None:
    db = _Db()
    store = JwtStore(db, SecretStr("secret"))

    await store.log_out(UserId(1))

    sql = "\n".join(_compile_mysql(stmt) for stmt in db.session.statements)
    assert "RETURNING" not in sql.upper()
    assert "SELECT" in sql.upper()
    assert "DELETE" in sql.upper()
