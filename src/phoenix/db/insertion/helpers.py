from abc import ABC
from enum import Enum, auto
from typing import Any, Awaitable, Callable, Mapping, Optional, Sequence

from sqlalchemy import Insert
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias, assert_never

from phoenix.db.helpers import SupportedSQLDialect


class DataManipulationEvent(ABC):
    """
    Execution of DML (Data Manipulation Language) statements.
    """


DataManipulation: TypeAlias = Callable[[AsyncSession], Awaitable[Optional[DataManipulationEvent]]]


class OnConflict(Enum):
    DO_NOTHING = auto()
    DO_UPDATE = auto()


def insert_on_conflict(
    dialect: SupportedSQLDialect,
    table: Any,
    values: Mapping[str, Any],
    constraint: str,
    column_names: Sequence[str],
    on_conflict: OnConflict = OnConflict.DO_NOTHING,
    set_: Optional[Mapping[str, Any]] = None,
) -> Insert:
    """
    Dialect specific insertion statement using ON CONFLICT DO syntax.
    """
    if dialect is SupportedSQLDialect.POSTGRESQL:
        stmt_postgresql = insert_postgresql(table).values(values)
        if on_conflict is OnConflict.DO_NOTHING or not set_:
            return stmt_postgresql.on_conflict_do_nothing(constraint=constraint)
        if on_conflict is OnConflict.DO_UPDATE:
            return stmt_postgresql.on_conflict_do_update(constraint=constraint, set_=set_)
        assert_never(on_conflict)
    if dialect is SupportedSQLDialect.SQLITE:
        stmt_sqlite = insert_sqlite(table).values(values)
        if on_conflict is OnConflict.DO_NOTHING or not set_:
            return stmt_sqlite.on_conflict_do_nothing(column_names)
        if on_conflict is OnConflict.DO_UPDATE:
            return stmt_sqlite.on_conflict_do_update(column_names, set_=set_)
        assert_never(on_conflict)
    assert_never(dialect)
