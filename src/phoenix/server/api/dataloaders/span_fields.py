from typing import Any, Iterable, Union

from sqlalchemy import Select, select
from sqlalchemy.orm import QueryableAttribute
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SpanRowId: TypeAlias = int

Key: TypeAlias = tuple[SpanRowId, QueryableAttribute[Any]]
Result: TypeAlias = Any


_ResultColumnPosition: TypeAlias = int
_AttrStrIdentifier: TypeAlias = str


class SpanFieldsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Union[Result, ValueError]]:
        result: dict[tuple[SpanRowId, _AttrStrIdentifier], Result] = {}
        stmt, attr_strs = _get_stmt(keys)
        async with self._db() as session:
            data = await session.stream(stmt)
            async for row in data:
                span_rowid: SpanRowId = row[0]  # models.Span's primary key
                for i, value in enumerate(row[1:]):
                    result[span_rowid, attr_strs[i]] = value
        return [result.get((span_rowid, str(attr))) for span_rowid, attr in keys]


def _get_stmt(
    keys: Iterable[Key],
) -> tuple[
    Select[Any],
    dict[_ResultColumnPosition, _AttrStrIdentifier],
]:
    """
    Generate a SQLAlchemy Select statement and a mapping of attribute identifiers (from their
    column positions in the query result starting at the second column).

    This function constructs a SQLAlchemy Select statement to query the `Span` model
    based on the provided keys. It also creates a mapping of attribute identifiers
    to their positions in the query result (starting at the second column as the zero-th
    position).

    Args:
        keys (list[Key]): A list of tuples, where each tuple contains an integer ID, i.e. the
            primary key of models.Span, and a QueryableAttribute.

    Returns:
        tuple: A tuple containing:
            - Select[Any]: A SQLAlchemy Select statement with `Span` ID and attributes.
            - dict[int, str]: A dictionary mapping the column position--where 0-th position starts
                at the second column (because the first column is the span's primary key)--in the
                result to the attribute's string identifier.
    """
    span_rowids: set[SpanRowId] = set()
    attrs: dict[_AttrStrIdentifier, QueryableAttribute[Any]] = {}
    joins = set()
    for span_rowid, attr in keys:
        span_rowids.add(span_rowid)
        attrs[str(attr)] = attr
        if (entity := attr.parent.entity) is not models.Span:
            joins.add(entity)
    stmt = select(models.Span.id).where(models.Span.id.in_(span_rowids))
    for table in joins:
        stmt = stmt.join(table)
    identifiers, columns = zip(*attrs.items())
    return stmt.add_columns(*columns), dict(enumerate(identifiers))
