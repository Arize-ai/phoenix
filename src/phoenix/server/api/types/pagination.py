import base64
from dataclasses import dataclass
from datetime import datetime
from enum import Enum, auto
from itertools import islice
from typing import Any, ClassVar, Iterable, Optional, Self, Tuple, Union

import strawberry
from strawberry.relay.types import Connection, Edge, NodeType, PageInfo
from strawberry.types import Info
from typing_extensions import TypeAlias, assert_never

ID: TypeAlias = int
CursorSortColumnValue: TypeAlias = Union[str, int, float, datetime]


class CursorSortColumnDataType(Enum):
    STRING = auto()
    INT = auto()
    FLOAT = auto()
    DATETIME = auto()


@dataclass
class CursorSortColumn:
    type: CursorSortColumnDataType
    value: CursorSortColumnValue

    def __str__(self) -> str:
        if isinstance(self.value, str):
            return self.value
        if isinstance(self.value, (int, float)):
            return str(self.value)
        if isinstance(self.value, datetime):
            return self.value.isoformat()
        assert_never(self.type)

    @classmethod
    def from_string(cls, type: CursorSortColumnDataType, cursor_string: str) -> "CursorSortColumn":
        value: CursorSortColumnValue
        if type is CursorSortColumnDataType.STRING:
            value = cursor_string
        elif type is CursorSortColumnDataType.INT:
            value = int(cursor_string)
        elif type is CursorSortColumnDataType.FLOAT:
            value = float(cursor_string)
        elif type is CursorSortColumnDataType.DATETIME:
            value = datetime.fromisoformat(cursor_string)
        else:
            assert_never(type)
        return cls(type=type, value=value)


@dataclass
class Cursor:
    """
    Serializes and deserializes cursor strings for ID-based pagination.

    In the simplest case, a cursor encodes the rowid of a record. In the case
    that a sort has been applied, the cursor additionally encodes the data type
    and value of the column indexed for sorting so that the sort position can be
    efficiently found. The encoding ensures that the cursor string is opaque to
    the client and discourages the client from making use of the encoded
    content.

    Examples:
        # encodes "10"
        Cursor(rowid=10)

        # encodes "11:STRING:abc"
        Cursor(
            rowid=11,
            sort_column=CursorSortColumn(
                type=CursorSortColumnDataType.STRING,
                value="abc"
            )
        )

        # encodes "10:INT:5"
        Cursor(
            rowid=10,
            sort_column=CursorSortColumn(
                type=CursorSortColumnDataType.INT,
                value=5
            )
        )

        # encodes "17:FLOAT:5.7"
        Cursor(
            rowid=17,
            sort_column=CursorSortColumn(
                type=CursorSortColumnDataType.FLOAT,
                value=5.7
            )
        )

        # encodes "20:DATETIME:2024-05-05T04:25:29.911245+00:00"
        Cursor(
            rowid=20,
            sort_column=CursorSortColumn(
                type=CursorSortColumnDataType.DATETIME,
                value=datetime.fromisoformat("2024-05-05T04:25:29.911245+00:00")
            )
        )
    """

    rowid: int
    sort_column: Optional[CursorSortColumn] = None

    _DELIMITER: ClassVar[str] = ":"

    def __str__(self) -> str:
        cursor_parts = [str(self.rowid)]
        if (sort_column := self.sort_column) is not None:
            cursor_parts.extend([sort_column.type.name, str(sort_column)])
        return base64.b64encode(self._DELIMITER.join(cursor_parts).encode()).decode()

    @classmethod
    def from_string(cls, cursor: str) -> "Cursor":
        decoded = base64.b64decode(cursor).decode()
        rowid_string = decoded
        sort_column = None
        if (first_delimiter_index := decoded.find(cls._DELIMITER)) > -1:
            rowid_string = decoded[:first_delimiter_index]
            second_delimiter_index = decoded.index(cls._DELIMITER, first_delimiter_index + 1)
            sort_column = CursorSortColumn.from_string(
                type=CursorSortColumnDataType[
                    decoded[first_delimiter_index + 1 : second_delimiter_index]
                ],
                cursor_string=decoded[second_delimiter_index + 1 :],
            )
        return cls(rowid=int(rowid_string), sort_column=sort_column)


@strawberry.type
class ForwardPaginatedConnection(Connection[NodeType]):
    @classmethod
    def resolve_connection(
        cls,
        data: Iterable[Tuple[Cursor, NodeType]],  # type: ignore
        *,
        info: Info,
        before: Optional[str] = None,
        after: Optional[str] = None,
        first: Optional[int] = None,
        last: Optional[int] = None,
        **kwargs: Any,
    ) -> Self:
        data_iterator = iter(data)
        edges = [
            Edge(node=node, cursor=str(cursor)) for cursor, node in islice(data_iterator, first)
        ]
        has_edges = len(edges) > 0
        first_edge = edges[0] if has_edges else None
        last_edge = edges[-1] if has_edges else None
        has_next_page: bool
        try:
            next(data_iterator)
            has_next_page = True
        except StopIteration:
            has_next_page = False
        return cls(
            edges=edges,
            page_info=PageInfo(
                start_cursor=first_edge.cursor if first_edge else None,
                end_cursor=last_edge.cursor if last_edge else None,
                has_previous_page=False,
                has_next_page=has_next_page,
            ),
        )
