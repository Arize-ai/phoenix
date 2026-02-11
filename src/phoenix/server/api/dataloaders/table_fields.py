from typing import Any, Iterable, Union

from sqlalchemy import Select, inspect, select
from sqlalchemy.orm import QueryableAttribute
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

PrimaryKey: TypeAlias = Any

Key: TypeAlias = tuple[PrimaryKey, QueryableAttribute[Any]]
Result: TypeAlias = Any

_ResultColumnPosition: TypeAlias = int
_AttrStrIdentifier: TypeAlias = str


class TableFieldsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory, table: type[models.Base]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db
        self._table = table

    async def _load_fn(self, keys: Iterable[Key]) -> list[Union[Result, ValueError]]:
        result: dict[tuple[PrimaryKey, _AttrStrIdentifier], Result] = {}
        stmt, attr_strs = _get_stmt(keys, self._table)
        async with self._db() as session:
            data = await session.stream(stmt)
            async for row in data:
                pk: PrimaryKey = row[0]
                for i, value in enumerate(row[1:]):
                    result[pk, attr_strs[i]] = value
        return [result.get((pk, str(attr))) for pk, attr in keys]


def _get_stmt(
    keys: Iterable[tuple[PrimaryKey, QueryableAttribute[Any]]],
    table: type[models.Base],
) -> tuple[Select[Any], dict[_ResultColumnPosition, _AttrStrIdentifier]]:
    """
    Construct a Select statement for the provided table along with a mapping that
    identifies each requested attribute by its position in the result row (after the
    primary-key column).

    Args:
        keys: Iterable of `(primary_key, attribute)` pairs describing which row
            and which column should be loaded.
        table: Declarative SQLAlchemy model class to query.

    Returns:
        tuple:
            Select[Any]: statement selecting the table's primary key followed by
                every unique attribute requested across `keys`. Joins are added
                automatically when an attribute belongs to another mapped entity.
            dict[int, str]: mapping from the zero-based column index (offset from
                the primary-key column) to the string identifier of that attribute.
    """
    pk_vals: set[PrimaryKey] = set()
    attrs: dict[_AttrStrIdentifier, QueryableAttribute[Any]] = {}
    joins = set()
    for pk, attr in keys:
        pk_vals.add(pk)
        attrs[str(attr)] = attr
        if (entity := attr.parent.entity) is not table:
            joins.add(entity)
    mapper = inspect(table)
    pk_col = mapper.primary_key[0]
    stmt = select(pk_col).where(pk_col.in_(pk_vals))
    for other_table in joins:
        stmt = stmt.join(other_table)
    identifiers, columns = zip(*attrs.items())
    return stmt.add_columns(*columns), dict(enumerate(identifiers))
