from datetime import datetime, timedelta, timezone

from phoenix.server.api.input_types.TimeRange import TimeRange


def test_ensure_time_range_utc() -> None:
    t1 = datetime.now()
    assert t1.tzinfo is None
    time_range = TimeRange(start=t1, end=t1)
    assert time_range.start
    assert (tzinfo := time_range.start.tzinfo) is not None
    assert tzinfo.utcoffset(None) == timedelta()
    assert time_range.start != t1
    assert time_range.start == t1.astimezone(timezone.utc)

    t2 = datetime.now(timezone.utc)
    assert (tzinfo := t2.tzinfo) is not None
    assert tzinfo.utcoffset(None) == timedelta()
    time_range = TimeRange(start=t2, end=t2)
    assert time_range.start
    assert (tzinfo := time_range.start.tzinfo) is not None
    assert tzinfo.utcoffset(None) == timedelta()
    assert time_range.start == t2
    assert time_range.start == t2.astimezone(timezone.utc)
