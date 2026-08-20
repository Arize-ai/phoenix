from datetime import datetime, timezone

import pytest

from phoenix.server.api.types.pagination import (
    Cursor,
    CursorSortColumn,
    CursorSortColumnDataType,
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

    @pytest.mark.parametrize("rowid", [-(2**31), 0, 2**31 - 1])
    def test_accepts_a_rowid_the_table_can_hold(self, rowid: int) -> None:
        cursor = Cursor(rowid=rowid)
        parsed = Cursor.parse(
            str(cursor), sort_column_type=None, rowid_range=range(-(2**31), 2**31)
        )
        assert parsed == cursor

    @pytest.mark.parametrize("rowid", [-(2**31) - 1, 2**31, 2**63])
    def test_rejects_a_rowid_the_table_cannot_hold(self, rowid: int) -> None:
        """Binding such a rowid raises in the driver instead of returning no rows."""
        with pytest.raises(ValueError):
            Cursor.parse(
                str(Cursor(rowid=rowid)),
                sort_column_type=None,
                rowid_range=range(-(2**31), 2**31),
            )

    def test_admits_any_rowid_when_the_caller_gives_no_range(self) -> None:
        cursor = Cursor(rowid=2**63)
        assert Cursor.parse(str(cursor), sort_column_type=None) == cursor
