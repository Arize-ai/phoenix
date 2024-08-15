from abc import ABC
from enum import Enum, auto
from typing import (
    Any,
    Awaitable,
    Callable,
    Iterable,
    Iterator,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    Type,
)

from sqlalchemy import Insert
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import KeyedColumnElement
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.models import Base


class DataManipulationEvent(ABC):
    """
    Execution of DML (Data Manipulation Language) statements.
    """


DataManipulation: TypeAlias = Callable[[AsyncSession], Awaitable[Optional[DataManipulationEvent]]]


class OnConflict(Enum):
    DO_NOTHING = auto()
    DO_UPDATE = auto()


def insert_on_conflict(
    *records: Mapping[str, Any],
    table: Type[Base],
    dialect: SupportedSQLDialect,
    unique_by: Sequence[str],
    on_conflict: OnConflict = OnConflict.DO_UPDATE,
    set_: Optional[Mapping[str, Any]] = None,
) -> Insert:
    """
    Dialect specific insertion statement using ON CONFLICT DO syntax.
    """
    if on_conflict is OnConflict.DO_UPDATE:
        # postegresql rejects duplicate updates for the same record
        seen = set()
        unique_records = []
        for v in reversed(records):
            if (k := tuple(v.get(name) for name in unique_by)) in seen:
                continue
            unique_records.append(v)
            seen.add(k)
        records = tuple(reversed(unique_records))
    constraint = "_".join(("uq", table.__tablename__, *unique_by))
    if dialect is SupportedSQLDialect.POSTGRESQL:
        stmt_postgresql = insert_postgresql(table).values(records)
        if on_conflict is OnConflict.DO_NOTHING:
            return stmt_postgresql.on_conflict_do_nothing(constraint=constraint)
        if on_conflict is OnConflict.DO_UPDATE:
            return stmt_postgresql.on_conflict_do_update(
                constraint=constraint,
                set_=set_ if set_ else dict(_clean(stmt_postgresql.excluded.items())),
            )
        assert_never(on_conflict)
    if dialect is SupportedSQLDialect.SQLITE:
        stmt_sqlite = insert_sqlite(table).values(records)
        if on_conflict is OnConflict.DO_NOTHING:
            return stmt_sqlite.on_conflict_do_nothing(unique_by)
        if on_conflict is OnConflict.DO_UPDATE:
            return stmt_sqlite.on_conflict_do_update(
                unique_by,
                set_=set_ if set_ else dict(_clean(stmt_sqlite.excluded.items())),
            )
        assert_never(on_conflict)
    assert_never(dialect)


def _clean(
    kv: Iterable[Tuple[str, KeyedColumnElement[Any]]],
) -> Iterator[Tuple[str, KeyedColumnElement[Any]]]:
    for k, v in kv:
        if v.primary_key or v.foreign_keys or k == "created_at":
            continue
        if k == "metadata_":
            yield "metadata", v
        else:
            yield k, v


def as_kv(obj: models.Base) -> Iterator[Tuple[str, Any]]:
    for k, c in obj.__table__.c.items():
        if k in ["created_at", "updated_at"]:
            continue
        k = "metadata_" if k == "metadata" else k
        v = getattr(obj, k, None)
        if c.primary_key and v is None:
            # postgresql disallows None for primary key
            continue
        yield k, v
