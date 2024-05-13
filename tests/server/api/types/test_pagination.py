from datetime import datetime

from phoenix.server.api.types.pagination import (
    Cursor,
    CursorSortColumn,
    CursorSortColumnDataType,
)


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
