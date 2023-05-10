from datetime import datetime, timedelta, timezone
from typing import Optional

import strawberry
from phoenix.server.api.interceptor import EnsureUTC, NoneIfNan


@strawberry.type
class T:
    x: Optional[float] = strawberry.field(default=NoneIfNan())


@strawberry.input
class S:
    t: datetime = strawberry.field(default=EnsureUTC())


def test_none_if_nan():
    assert T(x=float("nan")).x is None


def test_ensure_utc():
    t1 = datetime.now()
    assert t1.tzinfo is None
    assert S(t=t1).t.tzinfo.utcoffset(None) == timedelta()
    assert S(t=t1).t != t1
    assert S(t=t1).t == t1.astimezone(timezone.utc)

    t2 = datetime.now(timezone.utc)
    assert t2.tzinfo.utcoffset(None) == timedelta()
    assert S(t=t2).t.tzinfo.utcoffset(None) == timedelta()
    assert S(t=t2).t == t2
    assert S(t=t2).t == t2.astimezone(timezone.utc)

    t3 = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=-8)))
    assert t3.tzinfo.utcoffset(None) == timedelta(hours=-8)
    assert S(t=t3).t.tzinfo.utcoffset(None) == timedelta()
    assert S(t=t3).t == t3
    assert S(t=t3).t == t3.astimezone(timezone.utc)

    t4 = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=5, minutes=30)))
    assert t4.tzinfo.utcoffset(None) == timedelta(hours=5, minutes=30)
    assert S(t=t4).t.tzinfo.utcoffset(None) == timedelta()
    assert S(t=t4).t == t4
    assert S(t=t4).t == t4.astimezone(timezone.utc)
