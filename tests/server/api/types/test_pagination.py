from datetime import datetime

import phoenix.core.model_schema as ms
from phoenix.core.model_schema import FEATURE
from phoenix.server.api.types.Dimension import Dimension
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    Cursor,
    CursorSortColumn,
    CursorSortColumnDataType,
    connection_from_list,
)


def test_connection_from_list():
    dimensions = [
        Dimension(
            id_attr=0,
            name="first",
            type="feature",
            dataType="categorical",
            shape="discrete",
            dimension=ms.Dimension(role=FEATURE),
        ),
        Dimension(
            id_attr=1,
            name="second",
            type="feature",
            dataType="categorical",
            shape="discrete",
            dimension=ms.Dimension(role=FEATURE),
        ),
        Dimension(
            id_attr=2,
            name="third",
            type="feature",
            dataType="categorical",
            shape="discrete",
            dimension=ms.Dimension(role=FEATURE),
        ),
    ]
    connection = connection_from_list(dimensions, ConnectionArgs(first=2))

    # Check that the connection has the correct number of edges and that it has a next page
    assert len(connection.edges) == 2
    assert connection.page_info.has_next_page is True

    # Check that the connection can be paged forward
    next_connection = connection_from_list(
        dimensions, ConnectionArgs(first=2, after=connection.page_info.end_cursor)
    )
    assert len(next_connection.edges) == 1
    assert next_connection.page_info.has_next_page is False


def test_connection_from_list_reverse():
    dimensions = [
        Dimension(
            id_attr=0,
            name="first",
            type="feature",
            dataType="categorical",
            shape="discrete",
            dimension=ms.Dimension(role=FEATURE),
        ),
        Dimension(
            id_attr=1,
            name="second",
            type="feature",
            dataType="categorical",
            shape="discrete",
            dimension=ms.Dimension(role=FEATURE),
        ),
        Dimension(
            id_attr=2,
            name="third",
            type="feature",
            dataType="categorical",
            shape="discrete",
            dimension=ms.Dimension(role=FEATURE),
        ),
    ]
    connection = connection_from_list(dimensions, ConnectionArgs(last=2))

    # Check that the connection has the correct number of edges and that it has a previous page
    assert len(connection.edges) == 2
    assert connection.page_info.has_previous_page is True
    assert connection.page_info.has_next_page is False

    # Check that the connection can be paged backwards
    next_connection = connection_from_list(
        dimensions, ConnectionArgs(last=2, before=connection.page_info.start_cursor)
    )
    assert len(next_connection.edges) == 1
    assert next_connection.page_info.has_previous_page is False


def test_connection_from_empty_list():
    connection = connection_from_list([], ConnectionArgs(first=2))

    assert len(connection.edges) == 0
    assert connection.page_info.has_next_page is False


class TestCursor:
    def test_to_and_from_string_with_rowid_deserializes_original(self) -> None:
        original = Cursor(rowid=10)
        cursor = str(original)
        deserialized = Cursor.from_string(cursor)
        assert deserialized.rowid == 10
        assert deserialized.sort_column is None

    def test_to_and_from_string_with_rowid_and_string_deserializes_original(
        self,
    ) -> None:
        original = Cursor(
            rowid=10,
            sort_column=CursorSortColumn(type=CursorSortColumnDataType.STRING, value="abc"),
        )
        cursor_string = str(original)
        deserialized = Cursor.from_string(cursor_string)
        assert deserialized.rowid == 10
        assert (sort_column := deserialized.sort_column) is not None
        assert sort_column.type == CursorSortColumnDataType.STRING
        assert sort_column.value == "abc"

    def test_to_and_from_string_with_rowid_and_int_deserializes_original(
        self,
    ) -> None:
        original = Cursor(
            rowid=10, sort_column=CursorSortColumn(type=CursorSortColumnDataType.INT, value=11)
        )
        cursor_string = str(original)
        deserialized = Cursor.from_string(cursor_string)
        assert deserialized.rowid == 10
        assert (sort_column := deserialized.sort_column) is not None
        assert sort_column.type == CursorSortColumnDataType.INT
        assert isinstance((value := sort_column.value), int)
        assert value == 11

    def test_to_and_from_string_with_rowid_and_float_deserializes_original(
        self,
    ) -> None:
        original = Cursor(
            rowid=10, sort_column=CursorSortColumn(type=CursorSortColumnDataType.FLOAT, value=11.5)
        )
        cursor_string = str(original)
        deserialized = Cursor.from_string(cursor_string)
        assert deserialized.rowid == 10
        assert (sort_column := deserialized.sort_column) is not None
        assert sort_column.type == CursorSortColumnDataType.FLOAT
        assert abs(sort_column.value - 11.5) < 1e-8

    def test_to_and_from_string_with_rowid_and_float_passed_as_int_deserializes_original_as_float(
        self,
    ) -> None:
        original = Cursor(
            rowid=10,
            sort_column=CursorSortColumn(
                type=CursorSortColumnDataType.FLOAT,
                value=11,  # an integer value
            ),
        )
        cursor_string = str(original)
        deserialized = Cursor.from_string(cursor_string)
        assert deserialized.rowid == 10
        assert (sort_column := deserialized.sort_column) is not None
        assert sort_column.type == CursorSortColumnDataType.FLOAT
        assert isinstance((value := sort_column.value), float)
        assert abs(value - 11.0) < 1e-8

    def test_to_and_from_string_with_rowid_and_tz_naive_datetime_deserializes_original(
        self,
    ) -> None:
        timestamp = datetime.fromisoformat("2024-05-05T04:25:29.911245")
        original = Cursor(
            rowid=10,
            sort_column=CursorSortColumn(type=CursorSortColumnDataType.DATETIME, value=timestamp),
        )
        cursor_string = str(original)
        deserialized = Cursor.from_string(cursor_string)
        assert deserialized.rowid == 10
        assert (sort_column := deserialized.sort_column) is not None
        assert sort_column.type == CursorSortColumnDataType.DATETIME
        assert sort_column.value == timestamp
        assert sort_column.value.tzinfo is None

    def test_to_and_from_string_with_rowid_and_tz_aware_datetime_deserializes_original(
        self,
    ) -> None:
        timestamp = datetime.fromisoformat("2024-05-05T04:25:29.911245+00:00")
        original = Cursor(
            rowid=10,
            sort_column=CursorSortColumn(type=CursorSortColumnDataType.DATETIME, value=timestamp),
        )
        cursor_string = str(original)
        deserialized = Cursor.from_string(cursor_string)
        assert deserialized.rowid == 10
        assert (sort_column := deserialized.sort_column) is not None
        assert sort_column.type == CursorSortColumnDataType.DATETIME
        assert sort_column.value == timestamp
        assert sort_column.value.tzinfo is not None
