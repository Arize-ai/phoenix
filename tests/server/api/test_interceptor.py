from typing import Optional

import strawberry
from phoenix.server.api.interceptor import NoneIfNan


@strawberry.type
class T:
    x: Optional[float] = strawberry.field(default=NoneIfNan())


def test_none_if_nan():
    assert T(x=float("nan")).x is None
