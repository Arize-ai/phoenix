from datetime import datetime, timezone

from phoenix.server.api.types.Project import _as_datetime


def test_as_datetime_localizes_naive_values_as_utc() -> None:
    value = _as_datetime(datetime(2026, 6, 11, 9, 0, 0))

    assert value == datetime(2026, 6, 11, 9, 0, 0, tzinfo=timezone.utc)


def test_as_datetime_normalizes_aware_values_to_utc() -> None:
    value = _as_datetime(datetime(2026, 6, 11, 17, 0, 0, tzinfo=timezone.utc))

    assert value == datetime(2026, 6, 11, 17, 0, 0, tzinfo=timezone.utc)
