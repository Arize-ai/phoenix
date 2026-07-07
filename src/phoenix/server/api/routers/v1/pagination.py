"""REST API cursor pagination helpers."""

from __future__ import annotations

import operator
from typing import Any, Literal, Optional

from fastapi import HTTPException
from sqlalchemy import SQLColumnExpression, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID

from phoenix.server.api.types.pagination import (
    Cursor,
    CursorSortColumn,
    CursorSortColumnDataType,
    CursorSortColumnValue,
)

CompareDirection = Literal["asc", "desc"]


def encode_rest_cursor(
    rowid: int,
    sort_value: CursorSortColumnValue,
    sort_column_type: CursorSortColumnDataType,
) -> str:
    return str(
        Cursor(
            rowid=rowid,
            sort_column=CursorSortColumn(type=sort_column_type, value=sort_value),
        )
    )


async def parse_rest_cursor(
    session: AsyncSession,
    cursor_str: str,
    *,
    model: type[Any],
    sort_attr: str,
    sort_column_type: CursorSortColumnDataType,
) -> Cursor:
    """Parse a REST pagination cursor.

    Composite cursors encode ``(sort_value, rowid)``. Legacy GlobalID-only cursors
    are resolved by loading the referenced row so pagination stays correct after
    serial sequence wrap-around.
    """
    parsed: Optional[Cursor] = None
    try:
        parsed = Cursor.from_string(cursor_str)
        if parsed.sort_column is not None:
            return parsed
    except Exception:
        parsed = None

    rowid: int
    if parsed is not None:
        rowid = parsed.rowid
    else:
        try:
            rowid = int(GlobalID.from_id(cursor_str).node_id)
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid cursor format: {cursor_str}",
            ) from exc

    row = await session.get(model, rowid)
    if row is None:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid cursor format: {cursor_str}",
        )
    sort_value = getattr(row, sort_attr)
    return Cursor(
        rowid=rowid,
        sort_column=CursorSortColumn(type=sort_column_type, value=sort_value),
    )


def apply_tuple_cursor_filter(
    stmt: Any,
    *,
    sort_column: SQLColumnExpression[Any],
    id_column: SQLColumnExpression[Any],
    cursor: Cursor,
    order: CompareDirection,
    inclusive: bool = True,
) -> Any:
    """Apply a composite ``(sort_column, id)`` cursor filter."""
    if order == "desc":
        compare = operator.le if inclusive else operator.lt
    else:
        compare = operator.ge if inclusive else operator.gt

    if cursor.sort_column is None:
        return stmt.where(compare(id_column, cursor.rowid))

    return stmt.where(
        compare(
            tuple_(sort_column, id_column),
            (cursor.sort_column.value, cursor.rowid),
        )
    )
