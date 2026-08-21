from datetime import datetime, timezone

import pytest

from phoenix.server.api.types.pagination import (
    Cursor,
    CursorSortColumn,
    CursorSortColumnDataType,
    echo_cursor,
)


class TestCursorParse:
    """`Cursor.parse` admits only cursors the caller's own query minted."""

    @pytest.mark.parametrize(
        "sort_column",
        [
            pytest.param(
                CursorSortColumn(type=CursorSortColumnDataType.STRING, value="abc"), id="string"
            ),
            pytest.param(CursorSortColumn(type=CursorSortColumnDataType.INT, value=5), id="int"),
            pytest.param(
                CursorSortColumn(type=CursorSortColumnDataType.FLOAT, value=5.7), id="float"
            ),
            pytest.param(
                CursorSortColumn(
                    type=CursorSortColumnDataType.DATETIME,
                    value=datetime(2024, 5, 5, 4, 25, 29, 911245, tzinfo=timezone.utc),
                ),
                id="datetime",
            ),
        ],
    )
    def test_round_trips_a_cursor_matching_the_expected_sort_column(
        self,
        sort_column: CursorSortColumn,
    ) -> None:
        cursor = Cursor(rowid=10, sort_column=sort_column)
        assert Cursor.parse(str(cursor), sort_column_type=sort_column.type) == cursor

    def test_rejects_a_cursor_minted_under_a_different_sort_column(self) -> None:
        """The value would otherwise be compared against the wrong column."""
        cursor = Cursor(
            rowid=10,
            sort_column=CursorSortColumn(type=CursorSortColumnDataType.FLOAT, value=5.7),
        )
        with pytest.raises(ValueError):
            Cursor.parse(str(cursor), sort_column_type=CursorSortColumnDataType.DATETIME)

    def test_rejects_a_rowid_only_cursor_when_a_sort_value_is_expected(self) -> None:
        """A sorted query has no value to compare the boundary row against."""
        with pytest.raises(ValueError):
            Cursor.parse(str(Cursor(rowid=10)), sort_column_type=CursorSortColumnDataType.DATETIME)

    def test_accepts_a_rowid_only_cursor_when_no_sort_value_is_expected(self) -> None:
        cursor = Cursor(rowid=10)
        assert Cursor.parse(str(cursor), sort_column_type=None) == cursor

    def test_rejects_a_sorted_cursor_when_the_query_orders_by_rowid_alone(self) -> None:
        """Such a cursor came from a different query, whose page boundary differs."""
        cursor = Cursor(
            rowid=10,
            sort_column=CursorSortColumn(type=CursorSortColumnDataType.INT, value=5),
        )
        with pytest.raises(ValueError):
            Cursor.parse(str(cursor), sort_column_type=None)

    @pytest.mark.parametrize("cursor", ["not base64", "////", "", "Tk9UX0FfQ1VSU09S"])
    def test_rejects_a_malformed_cursor(self, cursor: str) -> None:
        with pytest.raises(ValueError):
            Cursor.parse(cursor, sort_column_type=None)

    def test_accepts_a_null_sort_value_when_the_column_is_nullable(self) -> None:
        """`__post_init__` tags a null value NULL, not the column's own type."""
        cursor = Cursor(
            rowid=10,
            sort_column=CursorSortColumn(type=CursorSortColumnDataType.FLOAT, value=None),
        )
        parsed = Cursor.parse(
            str(cursor), sort_column_type=CursorSortColumnDataType.FLOAT, nullable=True
        )
        assert parsed.sort_column is not None
        assert parsed.sort_column.type is CursorSortColumnDataType.NULL

    def test_rejects_a_null_sort_value_when_the_column_is_not_nullable(self) -> None:
        """A query without a null predicate cannot place such a row."""
        cursor = Cursor(
            rowid=10,
            sort_column=CursorSortColumn(type=CursorSortColumnDataType.FLOAT, value=None),
        )
        with pytest.raises(ValueError):
            Cursor.parse(str(cursor), sort_column_type=CursorSortColumnDataType.FLOAT)

    def test_still_rejects_a_mismatched_type_when_nullable(self) -> None:
        cursor = Cursor(
            rowid=10,
            sort_column=CursorSortColumn(
                type=CursorSortColumnDataType.DATETIME,
                value=datetime(2024, 5, 5, tzinfo=timezone.utc),
            ),
        )
        with pytest.raises(ValueError):
            Cursor.parse(
                str(cursor), sort_column_type=CursorSortColumnDataType.FLOAT, nullable=True
            )

    def test_rejects_nullable_without_a_sort_column_type(self) -> None:
        """A query that does not sort has no null sort value to admit."""
        with pytest.raises(ValueError):
            Cursor.parse(str(Cursor(rowid=10)), sort_column_type=None, nullable=True)


class TestEchoCursor:
    """A rejected cursor is quoted back bounded and printable."""

    def test_passes_a_short_printable_cursor_through(self) -> None:
        assert echo_cursor("MTA6SU5UOjU=") == "MTA6SU5UOjU="

    def test_truncates_an_overlong_cursor(self) -> None:
        echoed = echo_cursor("A" * 5000)
        assert echoed == "A" * 200 + "..."

    def test_replaces_control_characters(self) -> None:
        """A newline in the echo would otherwise forge a second log line."""
        assert echo_cursor("ab\nc\rd\x00e") == "ab?c?d?e"
