import base64
from dataclasses import dataclass
from datetime import datetime
from enum import Enum, auto
from typing import Any, ClassVar, List, Optional, Tuple, Union

from strawberry import UNSET
from strawberry.relay.types import Connection, Edge, NodeType, PageInfo
from typing_extensions import TypeAlias, assert_never

ID: TypeAlias = int
CursorSortColumnValue: TypeAlias = Union[str, int, float, datetime]

# A type alias for the connection cursor implementation
CursorString = str

# The hashing prefix for a connection cursor
CURSOR_PREFIX = "connection:"


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


def offset_to_cursor(offset: int) -> CursorString:
    """
    Creates the cursor string from an offset.
    """
    return base64.b64encode(f"{CURSOR_PREFIX}{offset}".encode("utf-8")).decode()


def cursor_to_offset(cursor: CursorString) -> int:
    """
    Extracts the offset from the cursor string.
    """
    prefix, offset = base64.b64decode(cursor).decode().split(":")
    return int(offset)


def get_offset_with_default(cursor: Optional[CursorString], default_offset: int) -> int:
    """
    Given an optional cursor and a default offset, returns the offset
    to use; if the cursor contains a valid offset, that will be used,
    otherwise it will be the default.
    """
    if not isinstance(cursor, CursorString):
        return default_offset
    offset = cursor_to_offset(cursor)
    return offset if isinstance(offset, int) else default_offset


@dataclass(frozen=True)
class ConnectionArgs:
    """
    Arguments common to all connections
    """

    first: Optional[int] = UNSET
    after: Optional[CursorString] = UNSET
    last: Optional[int] = UNSET
    before: Optional[CursorString] = UNSET


def connection_from_list(
    data: List[NodeType],
    args: ConnectionArgs,
) -> Connection[NodeType]:
    """
    A simple function that accepts a list and connection arguments, and returns
    a connection object for use in GraphQL. It uses list offsets as pagination,
    so pagination will only work if the list is static.
    """
    return connection_from_list_slice(data, args, slice_start=0, list_length=len(data))


def connection_from_list_slice(
    list_slice: List[NodeType],
    args: ConnectionArgs,
    slice_start: int,
    list_length: int,
) -> Connection[NodeType]:
    """
    Given a slice (subset) of a list, returns a connection object for use in
    GraphQL.

    This function is similar to `connection_from_list`, but is intended for use
    cases where you know the cardinality of the connection, consider it too large
    to materialize the entire list, and instead wish pass in a slice of the
    total result large enough to cover the range specified in `args`.
    """

    slice_end = slice_start + len(list_slice)

    start_offset = max(slice_start, 0)
    end_offset = min(slice_end, list_length)

    after_offset = get_offset_with_default(args.after, -1)

    if 0 <= after_offset < list_length:
        start_offset = max(start_offset, after_offset + 1)

    before_offset = get_offset_with_default(args.before, end_offset)

    if 0 <= before_offset < list_length:
        end_offset = min(end_offset, before_offset)

    if isinstance(args.first, int):
        if args.first < 0:
            raise Exception('Argument "first" must be a non-negative int')
        end_offset = min(end_offset, start_offset + args.first)

    if isinstance(args.last, int):
        if args.last < 0:
            raise Exception('Argument "last" must be a non-negative int')
        start_offset = max(start_offset, end_offset - args.last)

    # If supplied slice is too large, trim it down before mapping over it.
    slice = list_slice[start_offset - slice_start : end_offset - slice_start]

    edges = [
        Edge(node=node, cursor=offset_to_cursor(start_offset + index))
        for index, node in enumerate(slice)
    ]

    has_edges = len(edges) > 0
    first_edge = edges[0] if has_edges else None
    last_edge = edges[-1] if has_edges else None
    lower_bound = after_offset + 1 if args.after is not None else 0
    upper_bound = before_offset if args.before is not None else list_length

    return Connection(
        edges=edges,
        page_info=PageInfo(
            start_cursor=first_edge.cursor if first_edge else None,
            end_cursor=last_edge.cursor if last_edge else None,
            has_previous_page=start_offset > lower_bound if isinstance(args.last, int) else False,
            has_next_page=end_offset < upper_bound if isinstance(args.first, int) else False,
        ),
    )


def connection_from_cursors_and_nodes(
    cursors_and_nodes: List[Tuple[Any, NodeType]],
    has_previous_page: bool,
    has_next_page: bool,
) -> Connection[NodeType]:
    edges = [Edge(node=node, cursor=str(cursor)) for cursor, node in cursors_and_nodes]
    has_edges = len(edges) > 0
    first_edge = edges[0] if has_edges else None
    last_edge = edges[-1] if has_edges else None
    return Connection(
        edges=edges,
        page_info=PageInfo(
            start_cursor=first_edge.cursor if first_edge else None,
            end_cursor=last_edge.cursor if last_edge else None,
            has_previous_page=has_previous_page,
            has_next_page=has_next_page,
        ),
    )
