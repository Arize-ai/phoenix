from enum import Enum, auto
from typing import Any, Mapping, Optional, Sequence

from sqlalchemy import Insert, insert
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from typing_extensions import assert_never

from phoenix.db.helpers import SupportedSQLDialect


class OnConflict(Enum):
    DO_NOTHING = auto()
    DO_UPDATE = auto()


def insert_stmt(
    dialect: SupportedSQLDialect,
    table: Any,
    values: Mapping[str, Any],
    constraint: Optional[str] = None,
    column_names: Sequence[str] = (),
    on_conflict: OnConflict = OnConflict.DO_NOTHING,
    set_: Optional[Mapping[str, Any]] = None,
) -> Insert:
    """
    Dialect specific insertion statement using ON CONFLICT DO syntax.
    """
    if bool(constraint) != bool(column_names):
        raise ValueError(
            "Both `constraint` and `column_names` must be provided or omitted at the same time."
        )
    if (
        dialect is SupportedSQLDialect.POSTGRESQL
        and constraint is None
        or dialect is SupportedSQLDialect.SQLITE
        and not column_names
    ):
        return insert(table).values(values)
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
