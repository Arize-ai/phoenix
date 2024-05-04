import base64
from dataclasses import dataclass
from datetime import datetime
from enum import Enum, auto
from typing import ClassVar, Generic, List, Optional, Tuple, TypeVar, Union, assert_never

import strawberry
from strawberry import UNSET
from typing_extensions import TypeAlias

ID: TypeAlias = int
GenericType = TypeVar("GenericType")
SortableFieldValue: TypeAlias = Union[float, datetime]


@strawberry.type
class Connection(Generic[GenericType]):
    """Represents a paginated relationship between two entities

    This pattern is used when the relationship itself has attributes.
    """

    page_info: "PageInfo"
    edges: List["Edge[GenericType]"]


@strawberry.type
class PageInfo:
    """Pagination context to navigate objects with cursor-based pagination

    Instead of classic offset pagination via `page` and `limit` parameters,
    here we have a cursor of the last object and we fetch items starting from that one

    Read more at:
        - https://graphql.org/learn/pagination/#pagination-and-edges
        - https://relay.dev/graphql/connections.htm
    """

    has_next_page: bool
    has_previous_page: bool
    start_cursor: Optional[str]
    end_cursor: Optional[str]


# A type alias for the connection cursor implementation
Cursor = str


@strawberry.type
class Edge(Generic[GenericType]):
    """
    An edge may contain additional information of the relationship. This is the trivial case
    """

    node: GenericType
    cursor: str


# The hashing prefix for a connection cursor
CURSOR_PREFIX = "connection:"


class SortableFieldType(Enum):
    FLOAT = auto()
    DATETIME = auto()


@dataclass
class SortableField:
    type: SortableFieldType
    value: SortableFieldValue

    def stringify_value(self) -> str:
        if isinstance(self.value, float):
            return str(self.value)
        if isinstance(self.value, datetime):
            return self.value.isoformat()
        assert_never(self.type)

    @classmethod
    def from_stringified_value(
        cls, type: SortableFieldType, stringified_value: str
    ) -> "SortableField":
        value: SortableFieldValue
        if type == SortableFieldType.FLOAT:
            value = float(stringified_value)
        elif type == SortableFieldType.DATETIME:
            value = datetime.fromisoformat(stringified_value)
        else:
            assert_never(type)
        return cls(type=type, value=value)


@dataclass
class TupleIdentifier:
    rowid: int
    sortable_field: Optional[SortableField] = None

    _DELIMITER: ClassVar[str] = ":"

    def to_cursor(self) -> Cursor:
        cursor_components = [str(self.rowid)]
        if (sortable_field := self.sortable_field) is not None:
            cursor_components.extend([sortable_field.type.name, sortable_field.stringify_value()])
        return base64.b64encode(self._DELIMITER.join(cursor_components).encode()).decode()

    @classmethod
    def from_cursor(cls, cursor: Cursor) -> "TupleIdentifier":
        decoded = base64.b64decode(cursor).decode()
        rowid_string = decoded
        sortable_field = None
        if (first_delimiter_index := decoded.find(cls._DELIMITER)) > -1:
            rowid_string = decoded[:first_delimiter_index]
            second_delimiter_index = decoded.index(cls._DELIMITER, first_delimiter_index + 1)
            sortable_field = SortableField.from_stringified_value(
                type=SortableFieldType[decoded[first_delimiter_index + 1 : second_delimiter_index]],
                stringified_value=decoded[second_delimiter_index + 1 :],
            )
        return cls(rowid=int(rowid_string), sortable_field=sortable_field)


def offset_to_cursor(offset: int) -> Cursor:
    """
    Creates the cursor string from an offset.
    """
    return base64.b64encode(f"{CURSOR_PREFIX}{offset}".encode("utf-8")).decode()


def cursor_to_offset(cursor: Cursor) -> int:
    """
    Extracts the offset from the cursor string.
    """
    prefix, offset = base64.b64decode(cursor).decode().split(":")
    return int(offset)


def get_offset_with_default(cursor: Optional[Cursor], default_offset: int) -> int:
    """
    Given an optional cursor and a default offset, returns the offset
    to use; if the cursor contains a valid offset, that will be used,
    otherwise it will be the default.
    """
    if not isinstance(cursor, Cursor):
        return default_offset
    offset = cursor_to_offset(cursor)
    return offset if isinstance(offset, int) else default_offset


@dataclass(frozen=True)
class ConnectionArgs:
    """
    Arguments common to all connections
    """

    first: Optional[int] = UNSET
    after: Optional[Cursor] = UNSET
    last: Optional[int] = UNSET
    before: Optional[Cursor] = UNSET


def connection_from_list(
    data: List[GenericType],
    args: ConnectionArgs,
) -> Connection[GenericType]:
    """
    A simple function that accepts a list and connection arguments, and returns
    a connection object for use in GraphQL. It uses list offsets as pagination,
    so pagination will only work if the list is static.
    """
    return connection_from_list_slice(data, args, slice_start=0, list_length=len(data))


def connection_from_list_slice(
    list_slice: List[GenericType],
    args: ConnectionArgs,
    slice_start: int,
    list_length: int,
) -> Connection[GenericType]:
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


def connections(
    data: List[Tuple[TupleIdentifier, GenericType]],
    has_previous_page: bool,
    has_next_page: bool,
) -> Connection[GenericType]:
    edges = [
        Edge(node=node, cursor=tuple_identifier.to_cursor()) for tuple_identifier, node in data
    ]
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
