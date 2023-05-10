from datetime import datetime, timedelta, timezone

from phoenix.server.api.input_types.TimeRange import TimeRange


def test_ensure_time_range_utc():
    t1 = datetime.now()
    assert t1.tzinfo is None
    assert TimeRange(start=t1, end=t1).start.tzinfo.utcoffset(None) == timedelta()
    assert TimeRange(start=t1, end=t1).start != t1
    assert TimeRange(start=t1, end=t1).start == t1.astimezone(timezone.utc)

    t2 = datetime.now(timezone.utc)
    assert t2.tzinfo.utcoffset(None) == timedelta()
    assert TimeRange(start=t2, end=t2).start.tzinfo.utcoffset(None) == timedelta()
    assert TimeRange(start=t2, end=t2).start == t2
    assert TimeRange(start=t2, end=t2).start == t2.astimezone(timezone.utc)
